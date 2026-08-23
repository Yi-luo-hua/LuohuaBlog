(function () {
  function updateArticleLink() {
    var link = document.querySelector(".post-copyright__type a");
    if (!link) return;

    var currentUrl = window.location.href.split("#")[0].split("?")[0];
    link.href = currentUrl;
    try {
      link.textContent = decodeURI(currentUrl);
    } catch (_error) {
      link.textContent = currentUrl;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateArticleLink);
  } else {
    updateArticleLink();
  }

  document.addEventListener("pjax:complete", updateArticleLink);
})();
