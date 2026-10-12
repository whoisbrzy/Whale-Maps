import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="page page--center">
      <div className="container">
        <p className="eyebrow">404</p>
        <h1 className="page__title">This page drifted off the map</h1>
        <p className="page__lead">The page you're looking for doesn't exist or has moved.</p>
        <Link className="btn btn--primary" to="/">
          Back to home
        </Link>
      </div>
    </section>
  );
}
