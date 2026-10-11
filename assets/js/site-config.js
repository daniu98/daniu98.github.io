/* ===========================================================================
   SITE CONFIG — the one place to edit personal details, links and images.
   ---------------------------------------------------------------------------
   Every link, email address, résumé path and photo on the site is listed here.
   Change a value, reload the page, done — no build step.

   How it is wired up: index.html carries the same values as real `href`s so the
   page works with JavaScript disabled. On load, assets/js/site.js reads this
   file and rewrites anything tagged with data-link / data-text / data-img, so
   this file always wins. If you edit a link here and nowhere else, it updates.
   =========================================================================== */

window.SITE = {
  name: 'Daniel Xiao',
  initials: 'DX',
  role: 'Software Engineer',
  location: 'San Jose, CA',
  email: 'daniu9807@g.ucla.edu',

  /* Anchors referenced as data-link="key" in index.html */
  links: {
    github:        'https://github.com/daniu98',
    linkedin:      'https://linkedin.com/in/daniel-xiao',
    resume:        'assets/doc/Daniel-Xiao-Resume.pdf',
    photography:   'creative.html',

    ucla:          'https://www.ucla.edu',
    bumblebee:     'https://www.bumblebeenet.com',
    purdue:        'https://www.purdue.edu',

    treereq:       'https://treereq.com',
    treereqSource: 'https://github.com/daniu98/treereq',
    aiaaPaper:     'https://arc.aiaa.org/doi/10.2514/6.2024-4123',
    mnistNotebook: 'https://colab.research.google.com/drive/1HHswCzuCuXArwtf1NBRv7ikT0AHCt6qm?usp=sharing'
  },

  /* Images referenced as data-img="key". Each entry is a responsive pair:
     `small` is served up to 760px wide, `large` up to 1500px.
     Drop replacements in assets/img/opt/ at the same two sizes.  */
  images: {
    hero:      { small: 'assets/img/opt/profile-800.jpg',    large: 'assets/img/opt/profile-1600.jpg',    alt: 'Daniel Xiao in a white UCLA jersey, tracking the play during a game' },
    jersey:    { small: 'assets/img/opt/DSC09816-800.jpg',   large: 'assets/img/opt/DSC09816-1600.jpg',   alt: 'Daniel Xiao skating away from the camera, XIAO and the number 9 across the back of his jersey' },
    bench:     { small: 'assets/img/opt/IMG_6061-800.jpg',   large: 'assets/img/opt/IMG_6061-1600.jpg',   alt: 'Daniel Xiao alone on the ice in a blue UCLA jersey, looking back over his shoulder' },
    team:      { small: 'assets/img/opt/IMG_5037-800.jpg',   large: 'assets/img/opt/IMG_5037-1600.jpg',   alt: 'The UCLA team gathered on the ice with a trophy after a game' },
    blueline:  { small: 'assets/img/opt/IMG_0213-800.jpg',   large: 'assets/img/opt/IMG_0213-1600.jpg',   alt: 'A team lined up along the blue line for the national anthem' }
  }
};
