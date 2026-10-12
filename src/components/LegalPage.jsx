import { SITE } from "../config.js";

/* Shared layout for Terms and Privacy. `sections` is an array of
   { title, body } where body is JSX (paragraphs and lists). */
export default function LegalPage({ title, intro, sections }) {
  return (
    <article className="page">
      <div className="container container--narrow">
        <p className="eyebrow">Legal</p>
        <h1 className="page__title">{title}</h1>
        <p className="page__meta">Last updated {SITE.legalUpdated}</p>
        {intro && <p className="page__lead">{intro}</p>}

        <div className="legal">
          {sections.map((s, i) => (
            <section key={s.title} className="legal__section">
              <h2>
                <span className="legal__num">{i + 1}.</span> {s.title}
              </h2>
              {s.body}
            </section>
          ))}

          {SITE.contactEmail && (
            <section className="legal__section">
              <h2>
                <span className="legal__num">{sections.length + 1}.</span> Contact
              </h2>
              <p>
                Questions about this page? Email{" "}
                <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
              </p>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
