import AcgNavigation from "../components/AcgNavigation";

const BiliHubPage = () => (
  <div className="relative min-h-screen overflow-hidden pt-24">
    <div
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden
      style={{
        background:
          "linear-gradient(145deg, #EAF6FF 0%, #FFEAF4 48%, #F3E8FF 100%)",
      }}
    />
    <div
      className="pointer-events-none fixed -left-24 top-32 -z-10 h-72 w-72 rounded-full bg-[#00C2FF]/15 blur-3xl"
      aria-hidden
    />
    <div
      className="pointer-events-none fixed -right-16 bottom-24 -z-10 h-80 w-80 rounded-full bg-[#FF6BAA]/20 blur-3xl"
      aria-hidden
    />

    <header className="container mx-auto px-3 pb-4 md:px-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#7C5CFF]/80">
        Bili Hub
      </p>
      <h1 className="mt-2 font-zentry text-4xl font-black uppercase text-[#2D2A3A] md:text-6xl">
        Candy Sky
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#2D2A3A]/75">
        Light anime palette — bangumi shelf & creator watchlist, tucked away from
        the main landing.
      </p>
    </header>

    <AcgNavigation />
  </div>
);

export default BiliHubPage;
