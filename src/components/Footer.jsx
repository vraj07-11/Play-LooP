import React from 'react';

export default function Footer({ setCurrentView }) {
  const handleNav = (e, path) => {
    e.preventDefault();
    const cleanPath = path.replace(/^#\/?/, '');
    if (setCurrentView) {
      setCurrentView(cleanPath);
    }
    window.location.hash = `#/${cleanPath}`;
    const mainContent = document.querySelector('.app-content');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openSocialHub = (e) => {
    e.preventDefault();
    window.open('https://github.com/vraj07-11/Play-LooP', '_blank', 'noopener,noreferrer');
  };

  return (
    <footer className="w-full mt-16 pt-12 pb-6 border-t border-white/10 bg-[#000000] text-zinc-400 select-none">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        
        {/* Main 4-column layout matching reference screenshot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 pb-4">
          
          {/* Brand & Description */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Play LooP
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
              Fast, privacy-respecting music streaming with offline support, collaborative rooms, enhanced video previews and smart playlists.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-base font-bold text-white mb-4">
              Platform
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="#/how-it-works"
                  onClick={(e) => handleNav(e, 'how-it-works')}
                  className="hover:text-white transition-colors cursor-pointer block"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="#/features"
                  onClick={(e) => handleNav(e, 'features')}
                  className="hover:text-white transition-colors cursor-pointer block"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#/faq"
                  onClick={(e) => handleNav(e, 'faq')}
                  className="hover:text-white transition-colors cursor-pointer block"
                >
                  FAQ
                </a>
              </li>
              <li>
                <a
                  href="#/blog"
                  onClick={(e) => handleNav(e, 'blog')}
                  className="hover:text-white transition-colors cursor-pointer block"
                >
                  Blog
                </a>
              </li>
            </ul>
          </div>

          {/* Company & Legal */}
          <div>
            <h3 className="text-base font-bold text-white mb-4">
              Company & Legal
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="#/about"
                  onClick={(e) => handleNav(e, 'about')}
                  className="hover:text-white transition-colors cursor-pointer block"
                >
                  About
                </a>
              </li>
              <li>
                <a
                  href="#/contact"
                  onClick={(e) => handleNav(e, 'contact')}
                  className="hover:text-white transition-colors cursor-pointer block"
                >
                  Contact
                </a>
              </li>
              <li>
                <a
                  href="#/privacy-policy"
                  onClick={(e) => handleNav(e, 'privacy-policy')}
                  className="hover:text-white transition-colors cursor-pointer block"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="#/terms-of-service"
                  onClick={(e) => handleNav(e, 'terms-of-service')}
                  className="hover:text-white transition-colors cursor-pointer block"
                >
                  Terms of Service
                </a>
              </li>
              <li>
                <a
                  href="#/cookie-policy"
                  onClick={(e) => handleNav(e, 'cookie-policy')}
                  className="hover:text-white transition-colors cursor-pointer block"
                >
                  Cookie Policy
                </a>
              </li>
              <li>
                <a
                  href="#/dmca"
                  onClick={(e) => handleNav(e, 'dmca')}
                  className="hover:text-white transition-colors cursor-pointer block"
                >
                  DMCA
                </a>
              </li>
              <li>
                <a
                  href="#/disclaimer"
                  onClick={(e) => handleNav(e, 'disclaimer')}
                  className="hover:text-white transition-colors cursor-pointer block"
                >
                  Disclaimer
                </a>
              </li>
            </ul>
          </div>

          {/* Stay Updated */}
          <div>
            <h3 className="text-base font-bold text-white mb-4">
              Stay Updated
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              Join our socials for updates and roadmap polls.
            </p>
            <div>
              <button
                type="button"
                onClick={openSocialHub}
                className="px-5 py-2.5 rounded-lg bg-[#141416] hover:bg-[#202024] border border-white/10 hover:border-white/20 text-sm font-medium text-white transition-all cursor-pointer"
              >
                Visit Social Hub
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-6">
              &copy; {new Date().getFullYear()} Play LooP. All rights reserved.
            </p>
          </div>

        </div>


      </div>
    </footer>
  );
}
