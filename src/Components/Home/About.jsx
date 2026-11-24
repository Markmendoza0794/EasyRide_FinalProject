const About = () => (
  <section className="er-about" id="about">
    <div>
      <h2>About Balayan UV Express</h2>
      <p>
        Serving passengers for 20 years, Balayan UV Express
        provides transport services between Balayan and Pasay.
        EasyRide helps passengers check van availability and
        supports daily terminal operations.
      </p>

      <h3 className="er-about-subheading">Terminal Location</h3>
      <p>
        Former Balayan Night Market, opposite Magundayao's
        bowling alley, Balayan, Batangas.
      </p>
      <p>
        For travel toward Tagaytay, Silang, Carmona, Southwoods,
        Maguyam, CALAX, Nuvali, and Pasay, please inquire at the
        terminal about available services and schedules.
      </p>
    </div>

    <div id="contact">
      <h2>Terminal Assistance and Private Trips</h2>
      <p>
        Vans are also available for private trips.
        Contact the terminal directly to inquire about
        availability, destinations, schedules, and rates.
      </p>
      <p>
        For regular trips, confirm boarding with terminal staff.
        Displayed seat counts do not reserve a seat.
      </p>
      <p><strong>Sample contact number: 09123456789</strong></p>
      <p>For demonstration only. Actual contact details to follow.</p>
    </div>

    <figure className="er-terminal-photo">
      <img
        src="/images/terminal-waiting-area.jpg"
        alt="Passengers seated in the terminal waiting area"
        loading="lazy"
      />
      <figcaption>Passenger waiting area at the terminal</figcaption>
    </figure>
  </section>
);

export default About;
