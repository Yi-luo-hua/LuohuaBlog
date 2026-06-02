import AcgNavigation from "../components/AcgNavigation";

const BiliHubPage = () => (
  <div className="min-h-screen bg-black pt-24">
    <header className="container mx-auto px-3 pb-6 md:px-10">
      <p className="font-circular-web text-xs uppercase tracking-[0.35em] text-blue-50/70">
        Subpage
      </p>
      <h1 className="mt-2 font-zentry text-4xl font-black uppercase text-blue-50 md:text-6xl">
        Bili Hub
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-blue-50/75">
        Bangumi tracker and creator radar — separate from the main landing scroll.
      </p>
    </header>
    <AcgNavigation />
  </div>
);

export default BiliHubPage;
