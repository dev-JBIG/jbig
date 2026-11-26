import React from "react";
import SvgIcon from "../Utils/SvgIcon";
import "./Footer.css";
import "./Footer-mobile.css";
import BrandMark from "../Utils/BrandMark";

const JBIG_INSTAGRAM_URL = "https://www.instagram.com/jbig.jbnu/";

const Footer: React.FC = () => (
    <footer className="footer">
        <div className="footer-inner">
            <div className="footer-brand">
                <BrandMark className="footer-brand-mark" loading="lazy" />
                <span className="footer-brand-name">JBIG</span>
                <span className="footer-brand-desc">JBNU Big Data &amp; AI Group</span>
            </div>
            <div className="footer-meta">
                <a
                    href={JBIG_INSTAGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social-link"
                    aria-label="JBIG 공식 인스타그램 (@jbig.jbnu)"
                    title="JBIG 공식 인스타그램 (@jbig.jbnu)"
                >
                    <SvgIcon name="instagram" className="footer-social-icon" />
                    <span>@jbig.jbnu</span>
                </a>
                <span className="footer-meta-sep" aria-hidden="true">·</span>
                <div className="footer-copyright">© 2025 JBIG. All rights reserved.</div>
            </div>
        </div>
    </footer>
);

export default Footer;
