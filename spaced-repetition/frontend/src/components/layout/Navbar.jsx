import { Navbar as BootstrapNavbar, Container, Nav, NavDropdown } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <BootstrapNavbar expand="lg" className="modern-navbar">
      <Container fluid className="navbar-container">
        <BootstrapNavbar.Brand as={Link} to={user ? "/dashboard" : "/"} className="modern-brand">
          <div className="brand-content">
            <img src="/icon-192.png" alt="Revize Logo" className="brand-logo" />
            <span className="brand-text">Revize</span>
          </div>
        </BootstrapNavbar.Brand>
        
        <BootstrapNavbar.Toggle aria-controls="basic-navbar-nav" className="modern-toggler" />
        
        <BootstrapNavbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto navbar-nav-modern">
            {user ? (
              <>
                <Nav.Link
                  as={Link}
                  to="/dashboard"
                  className="nav-link-modern dashboard-link"
                >
                  <i className="bi bi-grid-3x3-gap me-2"></i>
                  Dashboard
                </Nav.Link>
                <NavDropdown
                  title={
                    <span className="user-dropdown-title">
                      {user.profile_picture ? (
                        <img
                          src={user.profile_picture}
                          alt="Profile"
                          className="navbar-profile-picture me-2"
                        />
                      ) : (
                        <i className="bi bi-person-circle me-2"></i>
                      )}
                      {user.first_name || user.username}
                    </span>
                  }
                  id="user-dropdown"
                  align="end"
                  className="user-dropdown-modern"
                >
                  <NavDropdown.Item as={Link} to="/profile" className="dropdown-item-modern">
                    <i className="bi bi-gear me-2"></i>
                    Profile Settings
                  </NavDropdown.Item>
                  <NavDropdown.Divider className="dropdown-divider-modern" />
                  <NavDropdown.Item onClick={handleLogout} className="dropdown-item-modern logout-item">
                    <i className="bi bi-box-arrow-right me-2"></i>
                    Logout
                  </NavDropdown.Item>
                </NavDropdown>
              </>
            ) : (
              <>
                <Nav.Link as={Link} to="/" className="nav-link-modern">
                  Home
                </Nav.Link>
                <Nav.Link as={Link} to="/login" className="nav-link-modern">
                  Login
                </Nav.Link>
                <Nav.Link 
                  as={Link} 
                  to="/register" 
                  className="nav-link-modern cta-button"
                >
                  Get Started
                </Nav.Link>
              </>
            )}
          </Nav>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
};

export default Navbar; 