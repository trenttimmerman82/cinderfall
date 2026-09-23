CINDERFALL
==========

PLAY
  Double-click Cinderfall.html. It opens in your web browser (Chrome, Edge,
  Firefox or Safari on a desktop or laptop). Click Deploy, pick a difficulty,
  then click into the game to capture the mouse. Press Esc to pause.
  Needs a mouse and keyboard. Works offline; the custom fonts load only when
  you are online (otherwise system fonts are used).

SHARE
  - Send Cinderfall.html to anyone (email, AirDrop, USB). It is one file.
  - To get a public web link: drag Cinderfall.html onto https://app.netlify.com/drop
    or upload it to itch.io as an HTML game (rename it index.html and zip it).

EDIT
  The source/ folder holds the readable code (index.html, css/, js/).
  source/index.html also runs directly, but it loads three.js from the internet.
  After editing, run:  python3 source/build.py
  to regenerate source/dist/Cinderfall.html (the single-file version).
