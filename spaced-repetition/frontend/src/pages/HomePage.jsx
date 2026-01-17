import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [isVisible, setIsVisible] = useState({});
  const observerRefs = useRef({});

  const quotes = [
    { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
    { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
    { text: "Education is the passport to the future.", author: "Malcolm X" }
  ];

  const principles = [
    {
      number: "01",
      title: "Capture",
      description: "Add what you're learning. A concept, a chapter, an idea worth remembering.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 4v16m8-8H4" strokeLinecap="round"/>
        </svg>
      )
    },
    {
      number: "02",
      title: "Review",
      description: "We'll remind you at the perfect moment, just before you'd forget.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 6v6l4 2" strokeLinecap="round"/>
        </svg>
      )
    },
    {
      number: "03",
      title: "Remember",
      description: "Each review strengthens the memory. Knowledge becomes permanent.",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
          <path d="M9 21h6M10 17v4M14 17v4"/>
        </svg>
      )
    }
  ];

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible((prev) => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    Object.values(observerRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  // Quote rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [quotes.length]);

  return (
    <div className="zen-homepage">
      {/* Ambient Background */}
      <div className="ambient-bg">
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
        <div className="ambient-orb orb-3"></div>
      </div>

      {/* Navigation */}
      <nav className="zen-nav">
        <div className="nav-container">
          <Link to="/" className="nav-logo">
            <span className="logo-mark">R</span>
            <span className="logo-text">revize</span>
          </Link>
          <div className="nav-actions">
            <Link to="/login" className="nav-link">Sign in</Link>
            <Link to="/register" className="nav-cta">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="zen-hero">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              Science of Memory
            </div>

            <h1 className="hero-title">
              Learn once,
              <br />
              <span className="title-accent">remember forever</span>
            </h1>

            <p className="hero-subtitle">
              Spaced repetition transforms fleeting knowledge into lasting wisdom.
              Study smarter by reviewing at the perfect moment.
            </p>

            <div className="hero-actions">
              <Link to="/register" className="btn-primary">
                Begin Your Journey
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <Link to="/login" className="btn-secondary">
                Welcome back
              </Link>
            </div>

            <div className="hero-stats">
              <div className="stat">
                <span className="stat-value">90%</span>
                <span className="stat-label">retention rate</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <span className="stat-value">10x</span>
                <span className="stat-label">more effective</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <span className="stat-value">Free</span>
                <span className="stat-label">to start</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-card main-card">
              <div className="card-glow"></div>
              <div className="card-content">
                <div className="card-header">
                  <span className="card-icon">📚</span>
                  <span className="card-status studying">Studying</span>
                </div>
                <div className="card-body">
                  <h3 className="card-topic">The Forgetting Curve</h3>
                  <p className="card-preview">Without review, we forget 80% of new information within 24 hours...</p>
                </div>
                <div className="card-footer">
                  <div className="progress-ring">
                    <svg viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeDasharray="75 25" strokeLinecap="round" transform="rotate(-90 18 18)"/>
                    </svg>
                    <span>75%</span>
                  </div>
                  <span className="card-streak">🔥 7 day streak</span>
                </div>
              </div>
            </div>

            <div className="visual-card floating-card card-1">
              <span className="mini-icon">⏰</span>
              <span className="mini-text">Review in 2h</span>
            </div>

            <div className="visual-card floating-card card-2">
              <span className="mini-icon">✨</span>
              <span className="mini-text">Well done!</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section className="zen-quote" id="quote" ref={(el) => (observerRefs.current.quote = el)}>
        <div className={`quote-container ${isVisible.quote ? 'visible' : ''}`}>
          <div className="quote-mark">"</div>
          <div className="quote-carousel">
            {quotes.map((quote, index) => (
              <div key={index} className={`quote-item ${index === currentQuoteIndex ? 'active' : ''}`}>
                <blockquote>{quote.text}</blockquote>
                <cite>— {quote.author}</cite>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="zen-principles" id="principles" ref={(el) => (observerRefs.current.principles = el)}>
        <div className={`principles-container ${isVisible.principles ? 'visible' : ''}`}>
          <div className="section-header">
            <span className="section-tag">The Method</span>
            <h2 className="section-title">Three steps to lasting knowledge</h2>
            <p className="section-description">
              A simple rhythm that transforms how your brain retains information
            </p>
          </div>

          <div className="principles-grid">
            {principles.map((principle, index) => (
              <div key={index} className="principle-card" style={{ animationDelay: `${index * 150}ms` }}>
                <div className="principle-number">{principle.number}</div>
                <div className="principle-icon">{principle.icon}</div>
                <h3 className="principle-title">{principle.title}</h3>
                <p className="principle-description">{principle.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Science Section */}
      <section className="zen-science" id="science" ref={(el) => (observerRefs.current.science = el)}>
        <div className={`science-container ${isVisible.science ? 'visible' : ''}`}>
          <div className="science-content">
            <span className="section-tag">The Science</span>
            <h2 className="section-title">Why spaced repetition works</h2>
            <p className="science-text">
              German psychologist Hermann Ebbinghaus discovered the <strong>forgetting curve</strong> —
              without reinforcement, memories decay exponentially. But with strategically timed reviews,
              each repetition strengthens neural pathways, flattening the curve until the memory becomes permanent.
            </p>
            <div className="science-visual">
              <div className="curve-chart">
                <div className="curve-label start">100%</div>
                <div className="curve-label end">0%</div>
                <svg viewBox="0 0 200 100" preserveAspectRatio="none">
                  {/* Forgetting curve */}
                  <path
                    d="M0,10 Q50,80 200,95"
                    fill="none"
                    stroke="var(--color-danger)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    className="curve-forgetting"
                  />
                  {/* Retention curve with reviews */}
                  <path
                    d="M0,10 Q15,30 40,15 Q55,35 80,20 Q95,38 120,25 Q140,40 160,30 Q180,42 200,35"
                    fill="none"
                    stroke="var(--color-success)"
                    strokeWidth="2.5"
                    className="curve-retention"
                  />
                  {/* Review points */}
                  <circle cx="40" cy="15" r="4" fill="var(--color-accent-500)"/>
                  <circle cx="80" cy="20" r="4" fill="var(--color-accent-500)"/>
                  <circle cx="120" cy="25" r="4" fill="var(--color-accent-500)"/>
                  <circle cx="160" cy="30" r="4" fill="var(--color-accent-500)"/>
                </svg>
                <div className="curve-legend">
                  <span className="legend-item forgetting">Without review</span>
                  <span className="legend-item retention">With spaced repetition</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="zen-cta" id="cta" ref={(el) => (observerRefs.current.cta = el)}>
        <div className={`cta-container ${isVisible.cta ? 'visible' : ''}`}>
          <div className="cta-content">
            <h2 className="cta-title">Ready to remember what matters?</h2>
            <p className="cta-subtitle">
              Join learners who've transformed their relationship with knowledge.
              Your journey to lasting memory starts now.
            </p>
            <Link to="/register" className="cta-button">
              Start Learning Smarter
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <p className="cta-note">Free forever for individuals</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="zen-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <span className="logo-mark">R</span>
            <span className="logo-text">revize</span>
          </div>
          <p className="footer-quote">
            "The beautiful thing about learning is that no one can take it away from you."
            <cite>— B.B. King</cite>
          </p>
          <p className="footer-copyright">© {new Date().getFullYear()} Revize. Learn wisely.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
