import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faListCheck, faCalendarDays, faCog, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
	const { user, logout } = useAuth();
	const navigate = useNavigate();

	const handleLogout = async () => {
		await logout();
		navigate('/login');
	};

	return (
		<nav className="navbar">
			<div className="navbar-container">
				{user ? (
					<>
						<NavLink to="/" className="nav-link" title="Rezepte">
							<FontAwesomeIcon icon={faBook} /> <span>Rezepte</span>
						</NavLink>
						<NavLink to="/wochenplaner" className="nav-link" title="Wochenplaner">
							<FontAwesomeIcon icon={faCalendarDays} /> <span>Wochenplaner</span>
						</NavLink>
						<NavLink to="/einkaufsliste" className="nav-link" title="Einkaufsliste">
							<FontAwesomeIcon icon={faListCheck} /> <span>Einkaufsliste</span>
						</NavLink>
						<NavLink to="/einstellungen" className="nav-link" title="Einstellungen">
							<FontAwesomeIcon icon={faCog} /> <span>Einstellungen</span>
						</NavLink>
						<button onClick={handleLogout} className="nav-link logout-btn" title="Logout">
							<FontAwesomeIcon icon={faRightFromBracket} /> <span>Logout</span>
						</button>
					</>
				) : (
					<div className="nav-guest-message">
						<span>Smart Cookbook</span>
					</div>
				)}
			</div>
		</nav>
	);
};

export default Navbar;