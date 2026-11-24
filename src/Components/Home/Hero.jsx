const Hero = ({ setAccessOpen }) => (
  <section className="er-hero" id="home">
    <div className="er-hero-copy">
      <p className="er-eyebrow">EASYRIDE BALAYAN UV EXPRESS</p>
      <h1>Plan your next trip to Pasay.</h1>
      <p>Check available vans, remaining seats, and boarding status before heading to the terminal.</p>
      <div className="er-actions">

        <button type="button" onClick={() => setAccessOpen(true)}>Choose Your Access</button>
      </div>
    </div>
    <div className="er-hero-image"><img src="/images/easyride-hero-van.jpg" alt="White Toyota Hiace passenger van" /></div>
  </section>
);
export default Hero;
