import { useEffect } from "react";

const DESKTOP_QUERY = "(min-width: 1200px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const BUBBLE_SELECTOR = "[data-physics-bubble]";
const DRAG_BLOCK_SELECTOR = "button, input, audio, select, textarea";
// Gap a dragged card shoves its neighbours to. Nothing pushes at rest, so the
// authored layout is reproduced exactly even where it overlaps on purpose.
const DRAG_PUSH_CLEARANCE = 16;
// How hard a held card shoves a neighbour, in the same velocity units as the
// anchor spring. A neighbour comes to rest where the two cancel out, roughly
// DRAG_PUSH_SPEED / ANCHOR_STIFFNESS pixels off its own anchor.
const DRAG_PUSH_STIFFNESS = 0.05;
const DRAG_PUSH_SPEED = 6;
// Damped spring that returns every bubble to the spot the stylesheet gives it.
const ANCHOR_STIFFNESS = 0.075;
const ANCHOR_DAMPING = 0.86;
const SETTLE_DISTANCE = 0.5;
const SETTLE_SPEED = 0.2;
const SETTLE_FRAMES = 12;

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const magnitude = (x, y) => Math.sqrt(x * x + y * y) || 0.0001;

const resetBubbleTransform = (element) => {
  element.style.removeProperty("--physics-x");
  element.style.removeProperty("--physics-y");
  element.style.removeProperty("z-index");
  element.removeAttribute("data-dragging");
};

export const useBubblePhysics = (containerRef) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const desktopMedia = window.matchMedia(DESKTOP_QUERY);
    const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    let disposed = false;
    let launchTimer = 0;
    let resizeTimer = 0;
    let simulationGeneration = 0;
    let matterPromise = null;
    let stopSimulation = () => {};

    const loadMatter = () => {
      matterPromise ||= import("matter-js").then((module) => module.default || module);
      return matterPromise;
    };

    const resetAll = () => {
      container.classList.remove("is-physics-ready");
      container.querySelectorAll(BUBBLE_SELECTOR).forEach(resetBubbleTransform);
    };

    const startSimulation = async () => {
      const generation = simulationGeneration + 1;
      simulationGeneration = generation;
      stopSimulation();
      stopSimulation = () => {};
      resetAll();

      if (disposed || !desktopMedia.matches || reducedMotionMedia.matches) return;

      const Matter = await loadMatter();
      if (
        disposed ||
        generation !== simulationGeneration ||
        !desktopMedia.matches ||
        reducedMotionMedia.matches
      ) {
        return;
      }
      const { Bodies, Body, Composite, Engine } = Matter;

      const elements = Array.from(container.querySelectorAll(BUBBLE_SELECTOR));
      if (!elements.length) return;

      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;

      // The desktop constellation is scaled down to fit one screen, so a screen
      // pixel and a simulation pixel are not the same unit. The simulation runs in
      // unscaled layout pixels and only pointer input gets converted.
      let containerRect = container.getBoundingClientRect();
      let viewportScale = containerRect.width / width || 1;
      const refreshViewportMetrics = () => {
        containerRect = container.getBoundingClientRect();
        viewportScale = containerRect.width / width || 1;
      };
      const pointerToWorld = (event) => ({
        x: (event.clientX - containerRect.left) / viewportScale,
        y: (event.clientY - containerRect.top) / viewportScale,
      });

      const engine = Engine.create({ enableSleeping: false });
      engine.gravity.x = 0;
      engine.gravity.y = 0;
      engine.gravity.scale = 0;

      const records = elements.map((element) => {
        // offset* keeps the collision box in layout pixels, so neither the resting
        // tilt, the pop animation nor the fit scale can inflate it.
        const visualWidth = Math.max(36, element.offsetWidth);
        const visualHeight = Math.max(36, element.offsetHeight);
        const origin = {
          x: element.offsetLeft + visualWidth / 2,
          y: element.offsetTop + visualHeight / 2,
        };
        const body = Bodies.rectangle(
          origin.x,
          origin.y,
          visualWidth,
          visualHeight,
          {
            restitution: 0.58,
            friction: 0.04,
            frictionStatic: 0.08,
            frictionAir: 0.105,
            density: 0.001,
            sleepThreshold: 90,
            // Bubbles pass through each other in the solver and only collide with
            // the walls. Spacing is applied explicitly while dragging, so a layout
            // that overlaps by design is not silently pulled apart on load.
            collisionFilter: { group: -1 },
          },
        );
        Body.setInertia(body, Infinity);
        return {
          element,
          body,
          visualWidth,
          visualHeight,
          origin,
          anchor: origin,
        };
      });

      const wallThickness = 180;
      const walls = [
        Bodies.rectangle(width / 2, -wallThickness / 2, width + wallThickness * 2, wallThickness, { isStatic: true }),
        Bodies.rectangle(width / 2, height + wallThickness / 2, width + wallThickness * 2, wallThickness, { isStatic: true }),
        Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, { isStatic: true }),
        Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, { isStatic: true }),
      ];
      Composite.add(engine.world, [...records.map((record) => record.body), ...walls]);

      let activeDrags = 0;
      let stableFrames = 0;
      let simulationSettled = false;

      const removePointerListeners = records.map((record) => {
        const { element, body } = record;
        const drag = {
          pointerId: null,
          startX: 0,
          startY: 0,
          lastX: 0,
          lastY: 0,
          lastTime: 0,
          velocityX: 0,
          velocityY: 0,
          grabX: 0,
          grabY: 0,
          moved: false,
          suppressClick: false,
          clearClickTimer: 0,
        };

        const onPointerDown = (event) => {
          if (event.button !== 0 || drag.pointerId !== null) return;
          const blockedTarget = event.target.closest?.(DRAG_BLOCK_SELECTOR);
          if (blockedTarget && blockedTarget !== element) return;

          refreshViewportMetrics();
          const grabbed = pointerToWorld(event);
          drag.pointerId = event.pointerId;
          drag.startX = event.clientX;
          drag.startY = event.clientY;
          drag.lastX = event.clientX;
          drag.lastY = event.clientY;
          drag.lastTime = performance.now();
          drag.velocityX = 0;
          drag.velocityY = 0;
          // Hold the grabbed point under the cursor instead of snapping the card centre to it.
          drag.grabX = body.position.x - grabbed.x;
          drag.grabY = body.position.y - grabbed.y;
          drag.moved = false;
          window.clearTimeout(drag.clearClickTimer);
          Body.setStatic(body, true);
          element.setPointerCapture?.(event.pointerId);
          element.setAttribute("data-dragging", "true");
          element.style.zIndex = "40";
        };

        const onPointerMove = (event) => {
          if (event.pointerId !== drag.pointerId) return;
          const distance = magnitude(event.clientX - drag.startX, event.clientY - drag.startY);
          if (distance > 5 && !drag.moved) {
            drag.moved = true;
            activeDrags += 1;
            stableFrames = 0;
            simulationSettled = false;
          }
          if (!drag.moved) return;

          event.preventDefault();
          const time = performance.now();
          const elapsed = Math.max(8, time - drag.lastTime);
          drag.velocityX = (event.clientX - drag.lastX) / elapsed / viewportScale;
          drag.velocityY = (event.clientY - drag.lastY) / elapsed / viewportScale;
          drag.lastX = event.clientX;
          drag.lastY = event.clientY;
          drag.lastTime = time;
          const pointer = pointerToWorld(event);
          Body.setPosition(body, {
            x: clamp(pointer.x + drag.grabX, record.visualWidth / 2, width - record.visualWidth / 2),
            y: clamp(pointer.y + drag.grabY, record.visualHeight / 2, height - record.visualHeight / 2),
          });
        };

        const finishDrag = (event) => {
          if (event.pointerId !== drag.pointerId) return;
          element.releasePointerCapture?.(event.pointerId);
          Body.setStatic(body, false);
          Body.setInertia(body, Infinity);
          if (drag.moved) {
            activeDrags = Math.max(0, activeDrags - 1);
            Body.setVelocity(body, {
              x: clamp(drag.velocityX * 16, -18, 18),
              y: clamp(drag.velocityY * 16, -18, 18),
            });
            drag.suppressClick = true;
            drag.clearClickTimer = window.setTimeout(() => {
              drag.suppressClick = false;
            }, 420);
          }
          drag.pointerId = null;
          element.removeAttribute("data-dragging");
          element.style.removeProperty("z-index");
        };

        const onClick = (event) => {
          if (!drag.suppressClick) return;
          event.preventDefault();
          event.stopPropagation();
          drag.suppressClick = false;
        };

        element.addEventListener("pointerdown", onPointerDown);
        element.addEventListener("pointermove", onPointerMove);
        element.addEventListener("pointerup", finishDrag);
        element.addEventListener("pointercancel", finishDrag);
        element.addEventListener("click", onClick, true);

        return () => {
          window.clearTimeout(drag.clearClickTimer);
          element.removeEventListener("pointerdown", onPointerDown);
          element.removeEventListener("pointermove", onPointerMove);
          element.removeEventListener("pointerup", finishDrag);
          element.removeEventListener("pointercancel", finishDrag);
          element.removeEventListener("click", onClick, true);
        };
      });

      const applyForces = () => {
        let displaced = false;
        records.forEach((record) => {
          const { body, anchor } = record;
          if (body.isStatic) return;
          const dx = anchor.x - body.position.x;
          const dy = anchor.y - body.position.y;
          if (Math.abs(dx) > SETTLE_DISTANCE || Math.abs(dy) > SETTLE_DISTANCE) displaced = true;
          Body.setVelocity(body, {
            x: body.velocity.x * ANCHOR_DAMPING + dx * ANCHOR_STIFFNESS,
            y: body.velocity.y * ANCHOR_DAMPING + dy * ANCHOR_STIFFNESS,
          });
        });

        // Only a card held by the cursor pushes anything. With no drag in flight
        // there are no pair forces at all, which is what lets the constellation
        // come back to rest on its authored coordinates.
        if (activeDrags === 0) return displaced;

        records.forEach((held) => {
          if (!held.body.isStatic) return;
          records.forEach((other) => {
            if (other === held || other.body.isStatic) return;
            const dx = other.body.position.x - held.body.position.x;
            const dy = other.body.position.y - held.body.position.y;
            const overlapX =
              (held.visualWidth + other.visualWidth) / 2 + DRAG_PUSH_CLEARANCE - Math.abs(dx);
            const overlapY =
              (held.visualHeight + other.visualHeight) / 2 + DRAG_PUSH_CLEARANCE - Math.abs(dy);
            if (overlapX <= 0 || overlapY <= 0) return;

            const distance = magnitude(dx, dy);
            const push = Math.min(
              Math.min(overlapX, overlapY) * DRAG_PUSH_STIFFNESS,
              DRAG_PUSH_SPEED,
            );
            Body.setVelocity(other.body, {
              x: other.body.velocity.x + (dx / distance) * push,
              y: other.body.velocity.y + (dy / distance) * push,
            });
          });
        });
        return true;
      };

      let animationFrame = 0;
      let previousTime = performance.now();
      const frame = (time) => {
        if (disposed) return;
        const delta = clamp(time - previousTime, 8, 1000 / 60);
        previousTime = time;
        if (!simulationSettled) {
          const displaced = applyForces();
          Engine.update(engine, delta);

          const maxSpeed = records.reduce(
            (maximum, record) => Math.max(maximum, record.body.speed),
            0,
          );
          stableFrames =
            activeDrags === 0 && !displaced && maxSpeed < SETTLE_SPEED ? stableFrames + 1 : 0;
          if (stableFrames > SETTLE_FRAMES) {
            // Land on the authored coordinates instead of merely near them.
            records.forEach((record) => {
              if (record.body.isStatic) return;
              Body.setPosition(record.body, { x: record.anchor.x, y: record.anchor.y });
              Body.setVelocity(record.body, { x: 0, y: 0 });
              Body.setAngularVelocity(record.body, 0);
            });
            simulationSettled = true;
          }
        }
        records.forEach((record) => {
          record.element.style.setProperty(
            "--physics-x",
            `${record.body.position.x - record.origin.x}px`,
          );
          record.element.style.setProperty(
            "--physics-y",
            `${record.body.position.y - record.origin.y}px`,
          );
        });
        animationFrame = window.requestAnimationFrame(frame);
      };

      container.classList.add("is-physics-ready");
      animationFrame = window.requestAnimationFrame(frame);
      window.addEventListener("scroll", refreshViewportMetrics, { passive: true });

      stopSimulation = () => {
        window.cancelAnimationFrame(animationFrame);
        window.removeEventListener("scroll", refreshViewportMetrics);
        removePointerListeners.forEach((remove) => remove());
        Composite.clear(engine.world, false, true);
        Engine.clear(engine);
        resetAll();
      };
    };

    const scheduleInitialLaunch = () => {
      window.clearTimeout(launchTimer);
      launchTimer = window.setTimeout(startSimulation, 1650);
    };

    const scheduleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(startSimulation, 180);
    };

    scheduleInitialLaunch();
    window.addEventListener("resize", scheduleResize);
    desktopMedia.addEventListener("change", scheduleResize);
    reducedMotionMedia.addEventListener("change", scheduleResize);

    return () => {
      disposed = true;
      simulationGeneration += 1;
      window.clearTimeout(launchTimer);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", scheduleResize);
      desktopMedia.removeEventListener("change", scheduleResize);
      reducedMotionMedia.removeEventListener("change", scheduleResize);
      stopSimulation();
      resetAll();
    };
  }, [containerRef]);
};
