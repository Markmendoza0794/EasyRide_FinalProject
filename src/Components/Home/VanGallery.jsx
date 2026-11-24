import { useState } from "react";

const photos = [
  ["van-exterior.jpg", "Van Exterior"],
  ["van-front-seats.jpg", "Front Seats"],
  ["van-passenger-seats.jpg", "Passenger Seating"],
  ["van-front-view.jpg", "Front View"],
  ["van-side-view.jpg", "Side View"],
];

const VanGallery = () => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? photos : photos.slice(0, 3);

  return (
    <section className="er-gallery" aria-labelledby="van-gallery-title">
      <header>
        <div>
          <h2 id="van-gallery-title">Our Vans</h2>
          <p>Van and interior photos. Check the terminal board for current availability.</p>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="van-gallery-photos"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show Fewer Photos" : "View All Photos"}
        </button>
      </header>

      <div className="er-gallery-grid" id="van-gallery-photos">
        {visible.map(([file, label]) => (
          <figure key={file}>
            <a
              href={`/images/vans/${file}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${label} photo in a new tab`}
            >
              <img src={`/images/vans/${file}`} alt={label} loading="lazy" />
            </a>
            <figcaption>{label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
};

export default VanGallery;
