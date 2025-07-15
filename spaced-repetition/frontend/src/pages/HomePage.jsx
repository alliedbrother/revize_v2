import { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import learningIllustration from '../assets/images/learning-illustration.svg';
import bookIcon from '../assets/images/book-icon.svg';
import clockIcon from '../assets/images/clock-icon.svg';
import brainIcon from '../assets/images/brain-icon.svg';
import './HomePage.css';

const HomePage = () => {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const inspirationalQuotes = [
    {
      text: "The expert in anything was once a beginner.",
      author: "Helen Hayes"
    },
    {
      text: "Learning never exhausts the mind.",
      author: "Leonardo da Vinci"
    },
    {
      text: "Education is the most powerful weapon which you can use to change the world.",
      author: "Nelson Mandela"
    }
  ];



  const features = [
    {
      icon: bookIcon,
      title: "1. Create Topics",
      description: "Add subjects or topics you want to learn. Organize your study materials in one place.",
      gradient: "linear-gradient(135deg, #00d4aa, #00bcd4)"
    },
    {
      icon: clockIcon,
      title: "2. Schedule Reviews",
      description: "The system automatically schedules when to review each topic based on spaced repetition principles.",
      gradient: "linear-gradient(135deg, #00bcd4, #0096c7)"
    },
    {
      icon: brainIcon,
      title: "3. Retain Knowledge",
      description: "Regular reviews at increasing intervals help transfer information to long-term memory.",
      gradient: "linear-gradient(135deg, #0096c7, #1e3a8a)"
    }
  ];

  const benefits = [
    { icon: "🧠", label: "Science-Based" },
    { icon: "⚡", label: "Efficient Learning" },
    { icon: "📈", label: "Proven Results" },
    { icon: "🎯", label: "Personalized" }
  ];

  // Auto-rotate quotes every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prevIndex) => 
        (prevIndex + 1) % inspirationalQuotes.length
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [inspirationalQuotes.length]);

  return (
    <div className="modern-homepage">
                    {/* Hero Section */}
       <section className="hero-section">
         <div className="hero-grid">
           <div className="hero-left">
             <div className="hero-content-wrapper">
               <div className="hero-eyebrow">
                 <span className="eyebrow-dot"></span>
                 Memory Science
               </div>
               <h1 className="hero-heading">
                 Remember
                 <span className="hero-highlight"> Everything</span>
                 <br />You Learn
               </h1>
               <p className="hero-description">
                 Transform forgetting into lasting knowledge with spaced repetition. 
                 The proven method that helps you retain 90% more information.
               </p>
               
               <div className="hero-proof">
                 <div className="proof-item">
                   <div className="proof-visual">
                     <div className="memory-curve">
                       <div className="curve-line forgetting"></div>
                       <div className="curve-line retention"></div>
                     </div>
                   </div>
                   <div className="proof-text">
                     <strong>Without Spaced Repetition:</strong> Forget 80% in 24 hours
                     <br />
                     <strong>With Spaced Repetition:</strong> Retain 90% long-term
                   </div>
                 </div>
               </div>

               <div className="hero-cta">
                 <Button as={Link} to="/register" className="cta-primary">
                   Start Remembering More
                   <span className="cta-arrow">→</span>
                 </Button>
                 <Button as={Link} to="/login" className="cta-secondary">
                   Sign In
                 </Button>
               </div>
             </div>
           </div>
           
           <div className="hero-right">
             <div className="learning-simulator">
               <div className="simulator-header">
                 <div className="simulator-title">Learning Session</div>
                 <div className="simulator-status">Active</div>
               </div>
               
               <div className="topic-cards">
                 <div className="topic-card due-now">
                   <div className="topic-icon">🧬</div>
                   <div className="topic-info">
                     <div className="topic-name">DNA Structure</div>
                     <div className="topic-timing">Review now</div>
                   </div>
                   <div className="topic-streak">7🔥</div>
                 </div>
                 
                 <div className="topic-card due-soon">
                   <div className="topic-icon">⚛️</div>
                   <div className="topic-info">
                     <div className="topic-name">Atomic Theory</div>
                     <div className="topic-timing">In 2 hours</div>
                   </div>
                   <div className="topic-streak">12🔥</div>
                 </div>
                 
                 <div className="topic-card due-later">
                   <div className="topic-icon">🌍</div>
                   <div className="topic-info">
                     <div className="topic-name">Climate Zones</div>
                     <div className="topic-timing">Tomorrow</div>
                   </div>
                   <div className="topic-streak">5🔥</div>
                 </div>
               </div>
               
               <div className="retention-meter">
                 <div className="meter-label">Knowledge Retention</div>
                 <div className="meter-bar">
                   <div className="meter-fill" style={{width: '92%'}}></div>
                 </div>
                 <div className="meter-value">92%</div>
               </div>
             </div>
           </div>
         </div>
       </section>

      {/* Quote Section */}
      <section className="quote-section">
        <Container>
          <Row>
            <Col lg={8} className="mx-auto text-center">
              <div className="quote-carousel">
                {inspirationalQuotes.map((quote, index) => (
                  <div key={index} className={`quote-item ${index === currentQuoteIndex ? 'active' : ''}`}>
                    <blockquote className="quote-text">
                      "{quote.text}"
                    </blockquote>
                    <cite className="quote-author">— {quote.author}</cite>
                  </div>
                ))}
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <Container>
                     <Row className="text-center mb-5">
             <Col lg={8} className="mx-auto">
               <h2 className="section-title">How It Works</h2>
               <p className="section-subtitle">
                 Three simple steps to transform how you learn and retain information
               </p>
             </Col>
           </Row>
          <Row className="g-4">
            {features.map((feature, index) => (
              <Col md={4} key={index}>
                <Card className="feature-card h-100">
                  <Card.Body className="text-center">
                    <div className="feature-icon-container" style={{background: feature.gradient}}>
                      <img src={feature.icon} alt={feature.title} className="feature-icon" />
                    </div>
                    <Card.Title className="feature-title">{feature.title}</Card.Title>
                    <Card.Text className="feature-description">
                      {feature.description}
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-background">
          <div className="cta-pattern"></div>
        </div>
        <Container>
          <Row className="justify-content-center text-center">
            <Col lg={8}>
                             <h2 className="cta-title">Ready to Learn More Effectively?</h2>
               <p className="cta-subtitle">
                 Join students and professionals who use spaced repetition to study smarter, not harder. 
                 Start building knowledge that sticks.
               </p>
              <div className="cta-actions">
                <Button as={Link} to="/register" className="btn-primary-custom" size="lg">
                  <span>Get Started Free</span>
                  <i className="bi bi-rocket-takeoff"></i>
                </Button>
                                 <div className="cta-note">
                   <small>✨ Free to get started</small>
                 </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Footer Quote */}
      <section className="footer-quote">
        <Container>
          <Row>
            <Col className="text-center">
              <blockquote className="final-quote">
                "The beautiful thing about learning is that no one can take it away from you."
                <cite>— B.B. King</cite>
              </blockquote>
            </Col>
          </Row>
        </Container>
      </section>
    </div>
  );
};

export default HomePage; 