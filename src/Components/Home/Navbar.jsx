const Navbar = ({
  menuOpen,
  setMenuOpen,
  goHome,
  goToSection,
}) => {
  const navigate = (event, section) => {
    event.preventDefault();
    goToSection(section);
  };

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="nav-container">
        <a
          href="#home"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            goHome();
          }}
        >
          <img src="/logo.png" alt="EasyRide Logo" />

          <div className="brand-text">
            <strong>EASYRIDE</strong>
            <span>Balayan UV Express</span>
          </div>
        </a>

        <button
          type="button"
          className="menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="homepage-navigation"
        >
          {menuOpen ? "Close" : "Menu"}
        </button>

        <div
          id="homepage-navigation"
          className={`nav-links ${menuOpen ? "active" : ""}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMenuOpen(false);
            }
          }}
        >
          <a href="#home" onClick={(event) => navigate(event, "home")}>
            Home
          </a>

          <a
            href="#terminal-board"
            onClick={(event) => navigate(event, "terminal-board")}
          >
            Terminal Board
          </a>

          <a href="#about" onClick={(event) => navigate(event, "about")}>
            About
          </a>

          <a href="#contact" onClick={(event) => navigate(event, "contact")}>
            Contact
          </a>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
