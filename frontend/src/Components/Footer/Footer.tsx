import React from "react";
import "./Footer.css";
import "./Footer-mobile.css";

const Footer: React.FC = () => (
    <footer className="footer">
        <div className="footer-inner">
            <div className="footer-brand">
                <span className="footer-brand-mark" aria-hidden="true">J</span>
                <span className="footer-brand-name">JBIG</span>
                <span className="footer-brand-desc">JBNU Big Data &amp; AI Group</span>
            </div>
            <div className="footer-copyright">© 2025 JBIG. All rights reserved.</div>
        </div>
    </footer>
);

export default Footer;
