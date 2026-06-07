import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav style={{ background: '#333', padding: '1rem' }}>
      <Link to="/" style={{ color: 'white', marginRight: '1rem' }}>Home</Link>
      <Link to="/about" style={{ color: 'white', marginRight: '1rem' }}>About</Link>
      <Link to="/services" style={{ color: 'white', marginRight: '1rem' }}>Services</Link>
      <Link to="/contact" style={{ color: 'white' }}>Contact</Link>
    </nav>
  )
}

export default Navbar
