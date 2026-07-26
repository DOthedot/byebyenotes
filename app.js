// ── Constants ─────────────────────────────────────────────────────────────────
const LANGS  = ['python', 'javascript', 'typescript', 'sql', 'bash', 'json', 'yaml', 'go', 'rust'];
const FONTS  = ['jetbrains-mono', 'fira-code', 'source-code-pro', 'ibm-plex-mono', 'roboto-mono'];
const THEMES = [
  'monokai', 'github-dark', 'nord', 'solarized-light', 'dracula', 'one-dark', 'tokyo-night',
  'github-light', 'atom-one-light', 'gruvbox-light', 'solarized-dark', 'gruvbox-dark',
];

// Light vs dark, used to label theme rows (☀/☾) and sort the picker light-first.
// Every id in THEMES must have an entry (a test guards this).
const THEME_MODE = {
  'monokai':         'dark',
  'github-dark':     'dark',
  'nord':            'dark',
  'solarized-light': 'light',
  'dracula':         'dark',
  'one-dark':        'dark',
  'tokyo-night':     'dark',
  'github-light':    'light',
  'atom-one-light':  'light',
  'gruvbox-light':   'light',
  'solarized-dark':  'dark',
  'gruvbox-dark':    'dark',
};
function themeMode(t) { return THEME_MODE[t] === 'light' ? 'light' : 'dark'; }
function sortThemesByMode(themes, modeMap) {
  const mode = (t) => ((modeMap ? modeMap[t] : THEME_MODE[t]) === 'light' ? 'light' : 'dark');
  return [...themes.filter(t => mode(t) === 'light'), ...themes.filter(t => mode(t) === 'dark')];
}

// ── Language logos ────────────────────────────────────────────────────────────
// Single-colour brand glyphs (Simple Icons, fill=currentColor) shown in the code
// language pickers and on each code block's badge. sql has no brand mark (generic
// database glyph); any unknown language falls back to GENERIC_LANG_ICON.
const GENERIC_LANG_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6z"/></svg>';
const LANG_ICON = {
  python: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.77l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.17l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05-.05-1.23.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09zm13.09 3.95l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08z"/></svg>',
  javascript: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z"/></svg>',
  typescript: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/></svg>',
  bash: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.038,4.9l-7.577-4.498C13.009,0.134,12.505,0,12,0c-0.505,0-1.009,0.134-1.462,0.403L2.961,4.9 C2.057,5.437,1.5,6.429,1.5,7.503v8.995c0,1.073,0.557,2.066,1.462,2.603l7.577,4.497C10.991,23.866,11.495,24,12,24 c0.505,0,1.009-0.134,1.461-0.402l7.577-4.497c0.904-0.537,1.462-1.529,1.462-2.603V7.503C22.5,6.429,21.943,5.437,21.038,4.9z M15.17,18.946l0.013,0.646c0.001,0.078-0.05,0.167-0.111,0.198l-0.383,0.22c-0.061,0.031-0.111-0.007-0.112-0.085L14.57,19.29 c-0.328,0.136-0.66,0.169-0.872,0.084c-0.04-0.016-0.057-0.075-0.041-0.142l0.139-0.584c0.011-0.046,0.036-0.092,0.069-0.121 c0.012-0.011,0.024-0.02,0.036-0.026c0.022-0.011,0.043-0.014,0.062-0.006c0.229,0.077,0.521,0.041,0.802-0.101 c0.357-0.181,0.596-0.545,0.592-0.907c-0.003-0.328-0.181-0.465-0.613-0.468c-0.55,0.001-1.064-0.107-1.072-0.917 c-0.007-0.667,0.34-1.361,0.889-1.8l-0.007-0.652c-0.001-0.08,0.048-0.168,0.111-0.2l0.37-0.236 c0.061-0.031,0.111,0.007,0.112,0.087l0.006,0.653c0.273-0.109,0.511-0.138,0.726-0.088c0.047,0.012,0.067,0.076,0.048,0.151 l-0.144,0.578c-0.011,0.044-0.036,0.088-0.065,0.116c-0.012,0.012-0.025,0.021-0.038,0.028c-0.019,0.01-0.038,0.013-0.057,0.009 c-0.098-0.022-0.332-0.073-0.699,0.113c-0.385,0.195-0.52,0.53-0.517,0.778c0.003,0.297,0.155,0.387,0.681,0.396 c0.7,0.012,1.003,0.318,1.01,1.023C16.105,17.747,15.736,18.491,15.17,18.946z M19.143,17.859c0,0.06-0.008,0.116-0.058,0.145 l-1.916,1.164c-0.05,0.029-0.09,0.004-0.09-0.056v-0.494c0-0.06,0.037-0.093,0.087-0.122l1.887-1.129 c0.05-0.029,0.09-0.004,0.09,0.056V17.859z M20.459,6.797l-7.168,4.427c-0.894,0.523-1.553,1.109-1.553,2.187v8.833 c0,0.645,0.26,1.063,0.66,1.184c-0.131,0.023-0.264,0.039-0.398,0.039c-0.42,0-0.833-0.114-1.197-0.33L3.226,18.64 c-0.741-0.44-1.201-1.261-1.201-2.142V7.503c0-0.881,0.46-1.702,1.201-2.142l7.577-4.498c0.363-0.216,0.777-0.33,1.197-0.33 c0.419,0,0.833,0.114,1.197,0.33l7.577,4.498c0.624,0.371,1.046,1.013,1.164,1.732C21.686,6.557,21.12,6.411,20.459,6.797z"/></svg>',
  json: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.043 23.968c.479-.004.953-.029 1.426-.094a11.805 11.805 0 003.146-.863 12.404 12.404 0 003.793-2.542 11.977 11.977 0 002.44-3.427 11.794 11.794 0 001.02-3.476c.149-1.16.135-2.346-.045-3.499a11.96 11.96 0 00-.793-2.788 11.197 11.197 0 00-.854-1.617c-1.168-1.837-2.861-3.314-4.81-4.3a12.835 12.835 0 00-2.172-.87h-.005c.119.063.24.132.345.201.12.074.239.146.351.225a8.93 8.93 0 011.559 1.33c1.063 1.145 1.797 2.548 2.218 4.041.284.982.434 1.998.495 3.017.044.743.044 1.491-.047 2.229-.149 1.27-.554 2.51-1.228 3.596a7.475 7.475 0 01-1.903 2.084c-1.244.928-2.877 1.482-4.436 1.114a3.916 3.916 0 01-.748-.258 4.692 4.692 0 01-.779-.45 6.08 6.08 0 01-1.244-1.105 6.507 6.507 0 01-1.049-1.747 7.366 7.366 0 01-.494-2.54c-.03-1.273.225-2.553.854-3.67a6.43 6.43 0 011.663-1.918c.225-.178.464-.333.704-.479l.016-.007a5.121 5.121 0 00-1.441-.12 4.963 4.963 0 00-1.228.24c-.359.12-.704.27-1.019.45a6.146 6.146 0 00-.733.494c-.211.18-.42.36-.615.555-1.123 1.153-1.768 2.682-2.022 4.256-.15.973-.15 1.96-.091 2.95.105 1.395.391 2.787.945 4.062a8.518 8.518 0 001.348 2.173 8.14 8.14 0 003.132 2.23 7.934 7.934 0 002.113.54c.074.015.149.015.209.015zm-2.934-.398a4.102 4.102 0 01-.45-.228 8.5 8.5 0 01-2.038-1.534c-1.094-1.137-1.827-2.566-2.247-4.08a15.184 15.184 0 01-.495-3.172 12.14 12.14 0 01.046-2.082c.135-1.257.495-2.501 1.124-3.58a6.889 6.889 0 011.783-2.053 6.23 6.23 0 011.633-.9 5.363 5.363 0 013.522-.045c.029 0 .029 0 .045.03.015.015.045.015.06.03.045.016.104.045.165.074.239.12.479.271.704.42a6.294 6.294 0 012.097 2.502c.42.914.615 1.934.631 2.938.014 1.079-.18 2.157-.645 3.146a6.42 6.42 0 01-2.638 2.832c.09.03.18.045.271.075.225.044.449.074.688.074 1.468.045 2.892-.66 3.94-1.647.195-.18.375-.375.54-.585.225-.27.435-.54.614-.823.239-.375.435-.75.614-1.154a8.112 8.112 0 00.509-1.664c.196-1.004.211-2.022.149-3.026-.135-2.022-.673-4.045-1.842-5.724a9.054 9.054 0 00-.555-.719 9.868 9.868 0 00-1.063-1.034 8.477 8.477 0 00-1.363-.915 9.927 9.927 0 00-1.692-.598l-.3-.06c-.209-.03-.42-.044-.634-.06a8.453 8.453 0 00-1.015.016c-.704.045-1.412.16-2.112.337C5.799 1.227 2.863 3.566 1.3 6.67A11.834 11.834 0 00.238 9.801a11.81 11.81 0 00-.104 3.775c.12 1.02.374 2.023.778 2.977.227.57.511 1.124.825 1.648 1.094 1.783 2.683 3.236 4.51 4.24.688.39 1.408.69 2.157.944.226.074.45.15.689.21z"/></svg>',
  yaml: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m0 .97 4.111 6.453v4.09h2.638v-4.09L11.053.969H8.214L5.58 5.125 2.965.969Zm12.093.024-4.47 10.544h2.114l.97-2.345h4.775l.804 2.345h2.26L14.255.994Zm1.133 2.225 1.463 3.87h-3.096zm3.06 9.475v10.29H24v-2.199h-5.454v-8.091zm-12.175.002v10.335h2.217v-7.129l2.32 4.792h1.746l2.4-4.96v7.295h2.127V12.696h-2.904L9.44 17.37l-2.455-4.674Z"/></svg>',
  go: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M1.811 10.231c-.047 0-.058-.023-.035-.059l.246-.315c.023-.035.081-.058.128-.058h4.172c.046 0 .058.035.035.07l-.199.303c-.023.036-.082.07-.117.07zM.047 11.306c-.047 0-.059-.023-.035-.058l.245-.316c.023-.035.082-.058.129-.058h5.328c.047 0 .07.035.058.07l-.093.28c-.012.047-.058.07-.105.07zm2.828 1.075c-.047 0-.059-.035-.035-.07l.163-.292c.023-.035.07-.07.117-.07h2.337c.047 0 .07.035.07.082l-.023.28c0 .047-.047.082-.082.082zm12.129-2.36c-.736.187-1.239.327-1.963.514-.176.046-.187.058-.34-.117-.174-.199-.303-.327-.548-.444-.737-.362-1.45-.257-2.115.175-.795.514-1.204 1.274-1.192 2.22.011.935.654 1.706 1.577 1.835.795.105 1.46-.175 1.987-.77.105-.13.198-.27.315-.434H10.47c-.245 0-.304-.152-.222-.35.152-.362.432-.97.596-1.274a.315.315 0 01.292-.187h4.253c-.023.316-.023.631-.07.947a4.983 4.983 0 01-.958 2.29c-.841 1.11-1.94 1.8-3.33 1.986-1.145.152-2.209-.07-3.143-.77-.865-.655-1.356-1.52-1.484-2.595-.152-1.274.222-2.419.993-3.424.83-1.086 1.928-1.776 3.272-2.02 1.098-.2 2.15-.07 3.096.571.62.41 1.063.97 1.356 1.648.07.105.023.164-.117.2m3.868 6.461c-1.064-.024-2.034-.328-2.852-1.029a3.665 3.665 0 01-1.262-2.255c-.21-1.32.152-2.489.947-3.529.853-1.122 1.881-1.706 3.272-1.95 1.192-.21 2.314-.095 3.33.595.923.63 1.496 1.484 1.648 2.605.198 1.578-.257 2.863-1.344 3.962-.771.783-1.718 1.273-2.805 1.495-.315.06-.63.07-.934.106zm2.78-4.72c-.011-.153-.011-.27-.034-.387-.21-1.157-1.274-1.81-2.384-1.554-1.087.245-1.788.935-2.045 2.033-.21.912.234 1.835 1.075 2.21.643.28 1.285.244 1.905-.07.923-.48 1.425-1.228 1.484-2.233z"/></svg>',
  rust: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.8346 11.7033l-1.0073-.6236a13.7268 13.7268 0 00-.0283-.2936l.8656-.8069a.3483.3483 0 00-.1154-.578l-1.1066-.414a8.4958 8.4958 0 00-.087-.2856l.6904-.9587a.3462.3462 0 00-.2257-.5446l-1.1663-.1894a9.3574 9.3574 0 00-.1407-.2622l.49-1.0761a.3437.3437 0 00-.0274-.3361.3486.3486 0 00-.3006-.154l-1.1845.0416a6.7444 6.7444 0 00-.1873-.2268l.2723-1.153a.3472.3472 0 00-.417-.4172l-1.1532.2724a14.0183 14.0183 0 00-.2278-.1873l.0415-1.1845a.3442.3442 0 00-.49-.328l-1.076.491c-.0872-.0476-.1742-.0952-.2623-.1407l-.1903-1.1673A.3483.3483 0 0016.256.955l-.9597.6905a8.4867 8.4867 0 00-.2855-.086l-.414-1.1066a.3483.3483 0 00-.5781-.1154l-.8069.8666a9.2936 9.2936 0 00-.2936-.0284L12.2946.1683a.3462.3462 0 00-.5892 0l-.6236 1.0073a13.7383 13.7383 0 00-.2936.0284L9.9803.3374a.3462.3462 0 00-.578.1154l-.4141 1.1065c-.0962.0274-.1903.0567-.2855.086L7.744.955a.3483.3483 0 00-.5447.2258L7.009 2.348a9.3574 9.3574 0 00-.2622.1407l-1.0762-.491a.3462.3462 0 00-.49.328l.0416 1.1845a7.9826 7.9826 0 00-.2278.1873L3.8413 3.425a.3472.3472 0 00-.4171.4171l.2713 1.1531c-.0628.075-.1255.1509-.1863.2268l-1.1845-.0415a.3462.3462 0 00-.328.49l.491 1.0761a9.167 9.167 0 00-.1407.2622l-1.1662.1894a.3483.3483 0 00-.2258.5446l.6904.9587a13.303 13.303 0 00-.087.2855l-1.1065.414a.3483.3483 0 00-.1155.5781l.8656.807a9.2936 9.2936 0 00-.0283.2935l-1.0073.6236a.3442.3442 0 000 .5892l1.0073.6236c.008.0982.0182.1964.0283.2936l-.8656.8079a.3462.3462 0 00.1155.578l1.1065.4141c.0273.0962.0567.1914.087.2855l-.6904.9587a.3452.3452 0 00.2268.5447l1.1662.1893c.0456.088.0922.1751.1408.2622l-.491 1.0762a.3462.3462 0 00.328.49l1.1834-.0415c.0618.0769.1235.1528.1873.2277l-.2713 1.1541a.3462.3462 0 00.4171.4161l1.153-.2713c.075.0638.151.1255.2279.1863l-.0415 1.1845a.3442.3442 0 00.49.327l1.0761-.49c.087.0486.1741.0951.2622.1407l.1903 1.1662a.3483.3483 0 00.5447.2268l.9587-.6904a9.299 9.299 0 00.2855.087l.414 1.1066a.3452.3452 0 00.5781.1154l.8079-.8656c.0972.0111.1954.0203.2936.0294l.6236 1.0073a.3472.3472 0 00.5892 0l.6236-1.0073c.0982-.0091.1964-.0183.2936-.0294l.8069.8656a.3483.3483 0 00.578-.1154l.4141-1.1066a8.4626 8.4626 0 00.2855-.087l.9587.6904a.3452.3452 0 00.5447-.2268l.1903-1.1662c.088-.0456.1751-.0931.2622-.1407l1.0762.49a.3472.3472 0 00.49-.327l-.0415-1.1845a6.7267 6.7267 0 00.2267-.1863l1.1531.2713a.3472.3472 0 00.4171-.416l-.2713-1.1542c.0628-.0749.1255-.1508.1863-.2278l1.1845.0415a.3442.3442 0 00.328-.49l-.49-1.076c.0475-.0872.0951-.1742.1407-.2623l1.1662-.1893a.3483.3483 0 00.2258-.5447l-.6904-.9587.087-.2855 1.1066-.414a.3462.3462 0 00.1154-.5781l-.8656-.8079c.0101-.0972.0202-.1954.0283-.2936l1.0073-.6236a.3442.3442 0 000-.5892zm-6.7413 8.3551a.7138.7138 0 01.2986-1.396.714.714 0 11-.2997 1.396zm-.3422-2.3142a.649.649 0 00-.7715.5l-.3573 1.6685c-1.1035.501-2.3285.7795-3.6193.7795a8.7368 8.7368 0 01-3.6951-.814l-.3574-1.6684a.648.648 0 00-.7714-.499l-1.473.3158a8.7216 8.7216 0 01-.7613-.898h7.1676c.081 0 .1356-.0141.1356-.088v-2.536c0-.074-.0536-.0881-.1356-.0881h-2.0966v-1.6077h2.2677c.2065 0 1.1065.0587 1.394 1.2088.0901.3533.2875 1.5044.4232 1.8729.1346.413.6833 1.2381 1.2685 1.2381h3.5716a.7492.7492 0 00.1296-.0131 8.7874 8.7874 0 01-.8119.9526zM6.8369 20.024a.714.714 0 11-.2997-1.396.714.714 0 01.2997 1.396zM4.1177 8.9972a.7137.7137 0 11-1.304.5791.7137.7137 0 011.304-.579zm-.8352 1.9813l1.5347-.6824a.65.65 0 00.33-.8585l-.3158-.7147h1.2432v5.6025H3.5669a8.7753 8.7753 0 01-.2834-3.348zm6.7343-.5437V8.7836h2.9601c.153 0 1.0792.1772 1.0792.8697 0 .575-.7107.7815-1.2948.7815zm10.7574 1.4862c0 .2187-.008.4363-.0243.651h-.9c-.09 0-.1265.0586-.1265.1477v.413c0 .973-.5487 1.1846-1.0296 1.2382-.4576.0517-.9648-.1913-1.0275-.4717-.2704-1.5186-.7198-1.8436-1.4305-2.4034.8817-.5599 1.799-1.386 1.799-2.4915 0-1.1936-.819-1.9458-1.3769-2.3153-.7825-.5163-1.6491-.6195-1.883-.6195H5.4682a8.7651 8.7651 0 014.907-2.7699l1.0974 1.151a.648.648 0 00.9182.0213l1.227-1.1743a8.7753 8.7753 0 016.0044 4.2762l-.8403 1.8982a.652.652 0 00.33.8585l1.6178.7188c.0283.2875.0425.577.0425.8717zm-9.3006-9.5993a.7128.7128 0 11.984 1.0316.7137.7137 0 01-.984-1.0316zm8.3389 6.71a.7107.7107 0 01.9395-.3625.7137.7137 0 11-.9405.3635z"/></svg>',
  sql: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C7.03 3 3 4.79 3 7s4.03 4 9 4 9-1.79 9-4-4.03-4-9-4zm9 6.5c0 2.21-4.03 4-9 4s-9-1.79-9-4V12c0 2.21 4.03 4 9 4s9-1.79 9-4V9.5zm0 5c0 2.21-4.03 4-9 4s-9-1.79-9-4V17c0 2.21 4.03 4 9 4s9-1.79 9-4v-2.5z"/></svg>',
};
// hasOwnProperty guard: block.lang is free-form (it comes straight from the
// URL-hash state in loadState), so a crafted link could pass 'constructor' etc.
// A bare LANG_ICON[lang] would then resolve up the prototype chain to a function
// and stringify into the badge — keep the lookup to our own keys only.
function langIcon(lang) {
  return Object.prototype.hasOwnProperty.call(LANG_ICON, lang) ? LANG_ICON[lang] : GENERIC_LANG_ICON;
}
// Code-block badge markup — one source of truth for the picker's logo and the
// badge, so the glyph you pick is the glyph on the block.
function langBadgeHtml(lang) {
  return `${langIcon(lang)}<span class="lang-name">${escapeHtml(lang)}</span> <span class="caret">▾</span>`;
}

const FONT_LABELS = {
  'jetbrains-mono':  'JetBrains Mono',
  'fira-code':       'Fira Code',
  'source-code-pro': 'Source Code Pro',
  'ibm-plex-mono':   'IBM Plex Mono',
  'roboto-mono':     'Roboto Mono',
};
const FONT_CSS = {
  'jetbrains-mono':  "'JetBrains Mono', monospace",
  'fira-code':       "'Fira Code', monospace",
  'source-code-pro': "'Source Code Pro', monospace",
  'ibm-plex-mono':   "'IBM Plex Mono', monospace",
  'roboto-mono':     "'Roboto Mono', monospace",
};

const HLJS_THEME_URLS = {
  'monokai':         'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/monokai.min.css',
  'github-dark':     'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css',
  'nord':            'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/nord.min.css',
  'solarized-light': 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/solarized-light.min.css',
  'dracula':         'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/dracula.min.css',
  'one-dark':        'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css',
  'tokyo-night':     'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/tokyo-night-dark.min.css',
  'github-light':    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css',
  'atom-one-light':  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-light.min.css',
  'gruvbox-light':   'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/gruvbox-light-medium.min.css',
  'solarized-dark':  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/solarized-dark.min.css',
  'gruvbox-dark':    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/gruvbox-dark-medium.min.css',
};

const URL_SAFE_LIMIT = 8000;   // conservative cross-browser URL length budget
const QR_MAX_CHARS   = 2800;   // QR version 40, level L, 8-bit capacity ≈ 2953
const SNAP_KEY       = 'bbn.recent';
const PREFS_KEY      = 'bbn.prefs';
const SYNC_KEY_LS    = 'bbn.syncKey';
const SNAP_MAX       = 30;
const SYNC_DELAY     = 800;
const PUSH_DELAY     = 2000;

// ── App state ─────────────────────────────────────────────────────────────────
let currentFont  = 'jetbrains-mono';
let currentTheme = 'monokai';
let blocks       = [];          // [{ id, type, content, lang? }]
let nextId       = 0;
let noteId       = null;        // stable id for snapshot dedupe, travels in the URL
let activeBlockId = null;
let paletteOpen  = false;
let paletteMode  = null;        // 'command' | 'insert' | 'lang' | 'changeLang' | 'font' | 'theme' | 'export' | 'filename'
let paletteIndex = 0;
let paletteAnchor = null;       // {x, y} viewport coords for caret-anchored palette
let changeLangTarget = null;    // block id whose language is being changed
let folderTarget     = null;    // snapshot nid being filed into a folder
let formatSel        = null;    // { blockId, range } saved while the format palette is open
const collapsedFolders = new Set();
let copiedTimer  = null;
let saveBeforeNew  = true;
let pendingExport  = null;      // 'md' | 'pdf' | 'docx' | 'html' | 'newNote'
let focusMode    = false;
let shareOpen    = false;
let emptyVisible = false;
let homeNavIndex = -1;   // selected recent-row on the Home screen; -1 = none
let syncTimer    = null;
let lastUrlLen   = 0;
let syncKey      = null;   // SHA-256(passphrase) hex — presence means cross-device sync is on
let pushTimer    = null;

// ── DOM refs (populated in DOMContentLoaded) ──────────────────────────────────
let docContainer, statusMode, statusLang, statusFont, statusUrl, statusUrlFill,
    statusUrlText, statusHint, statusCopied;
let paletteOverlay, paletteEl, paletteSearch, paletteTitle, paletteList;
let emptyState, recentSection, recentList, exampleLink;
let shareOverlay, shareCard, shareLinkEl, shareQr, capFill, capText, shareTtlEl, shareFootMsg;
let shareTinyUrl = null;   // the URL currently shown in the share panel (tiny, or full-hash fallback)
let shareReq = 0;          // monotonic token so a stale in-flight upload can't overwrite a newer one
let fab;

// ── State encode / decode ─────────────────────────────────────────────────────
function encodeState(state) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(state));
}

function decodeState(hash) {
  if (!hash) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(hash);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

// ── Pure helpers (exported for tests) ─────────────────────────────────────────
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderInlineMd(escaped) {
  return escaped
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/==(?:(yellow|green|red|blue):)?([^=]+)==/g, (mm, c, t) => `<mark class="hl-${c || 'yellow'}">${t}</mark>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

// Line-based markdown renderer. Returns '' when nothing renders differently
// from plain text, so plain blocks skip the render layer entirely.
function renderMarkdown(text) {
  if (!text || !text.trim()) return '';
  const lines = text.split('\n');
  let anyMd = false;
  const html = lines.map((line, i) => {
    let m;
    if ((m = line.match(/^(#{1,3}) (.*)$/))) {
      anyMd = true;
      const lvl = m[1].length;
      return `<div class="md-h md-h${lvl}"><span class="md-mark">${m[1]}</span> ${renderInlineMd(escapeHtml(m[2]))}</div>`;
    }
    if (/^---+\s*$/.test(line)) {
      anyMd = true;
      return '<div class="md-divider"></div>';
    }
    if ((m = line.match(/^!\[([^\]]*?)(?:\|(\d{2,4}))?(?:\|(left|center|right|pos:-?[\d.]+,-?\d+,-?\d+))?\]\((https?:\/\/\S+)\)\s*$/))) {
      anyMd = true;
      const width = m[2] ? ` style="width:${m[2]}px"` : '';
      let cls = 'left', boxStyle = '';
      if (m[3] && m[3].startsWith('pos:')) {
        const [x, y, r] = m[3].slice(4).split(',').map(Number);
        cls = 'free';
        boxStyle = ` style="left:${x}%;top:${y}px;transform:rotate(${r}deg)"`;
      } else if (m[3]) {
        cls = m[3];
      }
      return `<div class="md-img ${cls}" data-line="${i}"><span class="img-box"${boxStyle}><img src="${escapeHtml(m[4])}" alt="${escapeHtml(m[1])}" loading="lazy" draggable="false"${width}><span class="img-rotate" title="drag to tilt">⟳</span><span class="img-handle" title="drag to resize"></span></span></div>`;
    }
    if ((m = line.match(/^- \[([ xX])\] (.*)$/))) {
      anyMd = true;
      const done = m[1] !== ' ';
      return `<div class="md-check${done ? ' done' : ''}" data-line="${i}"><span class="cb">${done ? '✓' : ''}</span><span>${renderInlineMd(escapeHtml(m[2]))}</span></div>`;
    }
    if ((m = line.match(/^- (.*)$/))) {
      anyMd = true;
      return `<div class="md-li"><span class="md-mark">–</span> ${renderInlineMd(escapeHtml(m[1]))}</div>`;
    }
    const inline = renderInlineMd(escapeHtml(line));
    if (inline !== escapeHtml(line)) anyMd = true;
    return `<div class="md-p">${inline || '&nbsp;'}</div>`;
  }).join('');
  return anyMd ? html : '';
}

function toggleCheckboxLine(text, lineIdx) {
  const lines = text.split('\n');
  const line = lines[lineIdx];
  if (line === undefined) return text;
  if (/^- \[ \] /.test(line))       lines[lineIdx] = line.replace('- [ ] ', '- [x] ');
  else if (/^- \[[xX]\] /.test(line)) lines[lineIdx] = line.replace(/^- \[[xX]\] /, '- [ ] ');
  return lines.join('\n');
}

function noteTitle(blockList) {
  for (const b of blockList) {
    const line = (b.content || '').split('\n').find(l => l.trim() && !/^---+\s*$/.test(l));
    if (line) {
      return line.replace(/^#{1,3} /, '').replace(/^- \[[ xX]\] /, '').replace(/^- /, '').trim().slice(0, 48);
    }
  }
  return 'untitled';
}

function capacityLevel(urlLen) {
  const ratio = Math.min(urlLen / URL_SAFE_LIMIT, 1);
  const level = ratio < 0.6 ? 'green' : ratio < 0.85 ? 'amber' : 'red';
  return { ratio, level };
}

function timeAgo(t, now = Date.now()) {
  const s = Math.floor((now - t) / 1000);
  if (s < 60)      return 'just now';
  if (s < 3600)    return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)   return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Recent-note snapshots (localStorage) ──────────────────────────────────────
function loadSnapshots() {
  try {
    const arr = JSON.parse(localStorage.getItem(SNAP_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveSnapshot(snap) {
  try {
    const list = loadSnapshots().filter(s => s.nid !== snap.nid);
    list.unshift(snap);
    localStorage.setItem(SNAP_KEY, JSON.stringify(list.slice(0, SNAP_MAX)));
  } catch (e) { /* storage unavailable — feature quietly off */ }
  schedulePush();
}

function groupByFolder(snaps) {
  const loose = [];
  const map = new Map();
  (snaps || []).forEach(s => {
    const f = (s.folder || '').trim();
    if (!f) loose.push(s);
    else {
      if (!map.has(f)) map.set(f, []);
      map.get(f).push(s);
    }
  });
  return { loose, folders: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
}

function assignFolder(nid, folder) {
  try {
    const list = loadSnapshots();
    const s = list.find(x => x.nid === nid);
    if (s) {
      s.folder = folder || null;
      localStorage.setItem(SNAP_KEY, JSON.stringify(list));
    }
  } catch (e) {}
  schedulePush();
  renderRecent();
}

function deleteSnapshot(nid) {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(loadSnapshots().filter(s => s.nid !== nid)));
  } catch (e) {}
  schedulePush();
  renderRecent();
}

// Newest entry per note id wins; result sorted newest-first, capped.
function mergeRecents(a, b) {
  const byNid = new Map();
  [...(a || []), ...(b || [])].forEach(s => {
    if (!s || !s.nid) return;
    const cur = byNid.get(s.nid);
    if (!cur || (s.t || 0) > (cur.t || 0)) byNid.set(s.nid, s);
  });
  return [...byNid.values()].sort((x, y) => (y.t || 0) - (x.t || 0)).slice(0, SNAP_MAX);
}

// ── Theme/font preferences (localStorage + optional sync) ─────────────────────
function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: currentTheme, font: currentFont, t: Date.now() }));
  } catch (e) { /* fine */ }
  pushNow();   // prefs changes are rare and easily lost to the debounce — push at once
}

// ── Cross-device sync (passphrase → SHA-256 key → /api/sync KV blob) ──────────
async function derivePassKey(phrase) {
  const data = new TextEncoder().encode('bbn-sync-v1:' + phrase);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function syncPull() {
  if (!syncKey) return;
  const res = await fetch('/api/sync', { headers: { 'x-sync-key': syncKey } });
  if (!res.ok) throw new Error('pull failed');
  const { data } = await res.json();
  if (!data) return;
  const merged = mergeRecents(loadSnapshots(), data.recents || []);
  try { localStorage.setItem(SNAP_KEY, JSON.stringify(merged)); } catch (e) {}
  // Adopt remote prefs only when they're newer than what this device has
  const localPrefs = loadPrefs();
  if (data.prefs && (data.prefs.t || 0) > (localPrefs.t || 0)) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(data.prefs)); } catch (e) {}
    // Apply visually unless a note's own theme/font is on screen
    if (!window.location.hash) {
      if (THEMES.includes(data.prefs.theme)) applyTheme(data.prefs.theme);
      if (FONTS.includes(data.prefs.font))   applyFont(data.prefs.font);
    }
  }
  if (emptyVisible) renderRecent();
}

function pushNow() {
  if (!syncKey) return;
  clearTimeout(pushTimer);
  fetch('/api/sync', {
    method: 'PUT',
    keepalive: true,   // survives tab close mid-request
    headers: { 'x-sync-key': syncKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recents: loadSnapshots(), prefs: loadPrefs() }),
  }).catch(() => {});
}

function schedulePush() {
  if (!syncKey) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, PUSH_DELAY);
}

async function enableSync(phrase) {
  try {
    syncKey = await derivePassKey(phrase);
    localStorage.setItem(SYNC_KEY_LS, syncKey);
    flashCopied('sync: connecting…');
    await syncPull();
    schedulePush();
    flashCopied('sync on ✓');
  } catch (e) {
    syncKey = null;
    try { localStorage.removeItem(SYNC_KEY_LS); } catch (err) {}
    flashCopied('sync failed — server not reachable');
  }
}

function disableSync() {
  syncKey = null;
  clearTimeout(pushTimer);
  try { localStorage.removeItem(SYNC_KEY_LS); } catch (e) {}
  flashCopied('sync off — this device keeps its local copy');
}

// ── Block model ───────────────────────────────────────────────────────────────
function createBlock(type, lang) {
  return { id: nextId++, type, lang: lang || null, content: '' };
}

function buildGutter() {
  const gutter = document.createElement('div');
  gutter.className = 'gutter';
  gutter.innerHTML = `
    <button data-act="add" title="add block below">+</button>
    <button data-act="up" title="move up">↑</button>
    <button data-act="down" title="move down">↓</button>
    <button data-act="del" title="delete block">✕</button>`;
  return gutter;
}

function buildTouchTools(isCode) {
  const tools = document.createElement('div');
  tools.className = 'touch-tools';
  tools.innerHTML = `
    <button data-act="up" title="move up">↑</button>
    <button data-act="down" title="move down">↓</button>
    <button data-act="add" title="add block">＋</button>
    ${isCode ? '<button data-act="copy" title="copy code">⧉</button>' : ''}
    <button data-act="del" title="delete">✕</button>`;
  return tools;
}

function buildBlockEl(block) {
  const div = document.createElement('div');
  div.className = `block ${block.type}-block`;
  div.dataset.id = block.id;

  div.appendChild(buildGutter());
  div.appendChild(buildTouchTools(block.type === 'code'));

  if (block.type === 'code') {
    const head = document.createElement('div');
    head.className = 'code-head';
    head.innerHTML = `
      <button class="lang-badge">${langBadgeHtml(block.lang)}</button>
      <span class="line-count"></span>
      <span class="head-actions"><button data-act="copy">copy</button></span>`;
    div.appendChild(head);

    const body = document.createElement('div');
    body.className = 'code-body';
    const pre  = document.createElement('pre');
    pre.className = 'hljs-layer';
    const code = document.createElement('code');
    pre.appendChild(code);
    body.appendChild(pre);

    const content = document.createElement('div');
    content.className = 'block-content';
    content.contentEditable = 'true';
    content.spellcheck = false;
    content.autocorrect = 'off';
    content.autocapitalize = 'off';
    if (block.content) content.innerText = block.content;
    body.appendChild(content);
    div.appendChild(body);
    return div;
  }

  const content = document.createElement('div');
  content.className = 'block-content';
  content.contentEditable = 'true';
  content.spellcheck = false;
  content.autocorrect = 'off';
  content.autocapitalize = 'off';
  if (block.content) content.innerText = block.content;
  div.appendChild(content);

  const mdLayer = document.createElement('div');
  mdLayer.className = 'md-layer';
  div.appendChild(mdLayer);

  return div;
}

function getBlockEl(id) {
  return docContainer.querySelector(`[data-id="${id}"]`);
}

function getContentEl(id) {
  return getBlockEl(id)?.querySelector('.block-content');
}

function getBlockIdFromEl(el) {
  const block = el.closest('.block');
  return block ? Number(block.dataset.id) : null;
}

function getBlockData(id) {
  return blocks.find(b => b.id === id);
}

function getBlockText(b) {
  const el = getBlockEl(b.id)?.querySelector('.block-content');
  // innerText of a hidden element (text block showing its markdown layer)
  // drops newlines, so only trust the DOM while the block is visible.
  if (el && el.offsetParent !== null) return el.innerText || '';
  return b.content;
}

function renderAllBlocks() {
  docContainer.innerHTML = '';
  blocks.forEach(b => {
    const el = buildBlockEl(b);
    docContainer.appendChild(el);
    if (b.type === 'code') {
      syncHighlight(b.id);
      updateLineCount(b.id);
    } else {
      syncMarkdown(b.id);
    }
  });
}

function syncHighlight(blockId) {
  const block = getBlockData(blockId);
  if (!block || block.type !== 'code') return;
  const el = getBlockEl(blockId);
  if (!el) return;
  const content = el.querySelector('.block-content');
  const code    = el.querySelector('.hljs-layer code');
  if (!content || !code) return;
  const text = content.innerText || '';
  const lang = block.lang === 'text' ? 'plaintext' : block.lang;
  try {
    code.innerHTML = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
  } catch (e) {
    code.textContent = text;
  }
}

function updateLineCount(blockId) {
  const el = getBlockEl(blockId);
  if (!el) return;
  const counter = el.querySelector('.line-count');
  if (!counter) return;
  const text = el.querySelector('.block-content')?.innerText || '';
  const n = text.trim() ? text.split('\n').length : 0;
  counter.textContent = n ? `${n} ln` : '';
}

function syncMarkdown(blockId) {
  const block = getBlockData(blockId);
  if (!block || block.type !== 'text') return;
  const el = getBlockEl(blockId);
  if (!el) return;
  const text = getBlockText(block);
  const html = renderMarkdown(text);
  const layer = el.querySelector('.md-layer');
  if (!layer) return;
  layer.innerHTML = html;
  el.classList.toggle('has-md', !!html);
}

function focusBlock(id, atEnd) {
  activeBlockId = id;
  const blockEl = getBlockEl(id);
  const content = getContentEl(id);
  if (!content) return;
  // Reveal the editable layer first — focus() on a display:none element is a no-op
  docContainer.querySelectorAll('.block.active, .block.editing').forEach(el => {
    if (el !== blockEl) el.classList.remove('active', 'editing');
  });
  blockEl.classList.add('active', 'editing');
  content.focus();
  if (atEnd) {
    const range = document.createRange();
    range.selectNodeContents(content);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  updateStatus();
}

function insertBlockAfter(afterId, newBlock) {
  const idx = blocks.findIndex(b => b.id === afterId);
  if (idx === -1) {
    blocks.push(newBlock);
  } else {
    blocks.splice(idx + 1, 0, newBlock);
  }
  const el = buildBlockEl(newBlock);
  const afterEl = getBlockEl(afterId);
  if (afterEl && afterEl.nextSibling) {
    docContainer.insertBefore(el, afterEl.nextSibling);
  } else {
    docContainer.appendChild(el);
  }
  return newBlock;
}

function moveBlock(id, dir) {
  const idx = blocks.findIndex(b => b.id === id);
  const newIdx = idx + dir;
  if (idx === -1 || newIdx < 0 || newIdx >= blocks.length) return;
  const swapId = blocks[newIdx].id;
  [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
  const currentEl = getBlockEl(id);
  const swapEl    = getBlockEl(swapId);
  if (dir === -1) {
    docContainer.insertBefore(currentEl, swapEl);
  } else {
    docContainer.insertBefore(swapEl, currentEl);
  }
  scheduleSync();
  updateStatus();
}

function deleteBlock(id) {
  if (blocks.length <= 1) return;
  const idx = blocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  const target = blocks[idx - 1] || blocks[idx + 1];
  blocks.splice(idx, 1);
  getBlockEl(id)?.remove();
  focusBlock(target.id, idx > 0);
  scheduleSync();
}

// Convert an existing (empty text) block into a code block in place.
function convertToCode(id, lang) {
  const idx = blocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  const block = blocks[idx];
  block.type = 'code';
  block.lang = lang;
  block.content = '';
  const oldEl = getBlockEl(id);
  const newEl = buildBlockEl(block);
  oldEl.replaceWith(newEl);
  syncHighlight(id);
  updateLineCount(id);
}

// ── Theme & font ──────────────────────────────────────────────────────────────
function applyTheme(theme) {
  currentTheme = theme;
  if (theme === 'monokai') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  const link = document.getElementById('hljs-theme');
  if (link) link.href = HLJS_THEME_URLS[theme];
  blocks.filter(b => b.type === 'code').forEach(b => syncHighlight(b.id));
}

function applyFont(font) {
  currentFont = font;
  document.body.style.fontFamily = FONT_CSS[font];
}

// ── Command palette ───────────────────────────────────────────────────────────
function buildCommandList() {
  return [
    { id: 'box',    label: '/box',    ico: '▣',  desc: 'insert code block' },
    { id: 'share',  label: '/share',  ico: '⎘',  desc: 'link · qr · capacity', kbd: '⌘⇧C' },
    { id: 'focus',  label: '/focus',  ico: '◎',  desc: focusMode ? 'exit focus mode' : 'distraction-free writing', kbd: '⌘.' },
    { id: 'theme',  label: '/theme',  ico: '◐',  desc: 'change theme' },
    { id: 'font',   label: '/font',   ico: 'Aa', desc: 'change font' },
    { id: 'export', label: '/export', ico: '⇩',  desc: 'md · pdf · docx · html' },
    { id: 'sync',   label: '/sync',   ico: '⟲',  desc: syncKey ? 'turn off cross-device sync' : 'sync notes across devices', hint: syncKey ? 'on' : null },
    { id: 'delete', label: '/delete', ico: '✕',  desc: 'delete current block' },
    { id: 'home',    label: '/home',    ico: '⌂', desc: 'back to the start screen' },
    { id: 'newNote', label: '/newNote', ico: '✚', desc: 'start a fresh note' },
    { id: 'saveBeforeNew', label: '/save_before_new', ico: '⋯', desc: 'save before new note', hint: saveBeforeNew ? 'on' : 'off' },
    { id: 'help',   label: '/help',   ico: '?', desc: 'commands, shortcuts & formatting' },
  ];
}

const FORMAT_MARKERS = {
  'bold':      ['**', '**'],
  'italic':    ['*', '*'],
  'strike':    ['~~', '~~'],
  'code':      ['`', '`'],
  'hl-yellow': ['==', '=='],
  'hl-green':  ['==green:', '=='],
  'hl-red':    ['==red:', '=='],
  'hl-blue':   ['==blue:', '=='],
};

// Remove existing markers of the same category from a selection before re-wrapping,
// so re-formatting a region makes it uniform instead of nesting broken markers.
// Aggressive on highlights so re-highlighting also repairs a previously-broken run.
function stripFormatting(s, id) {
  if (id && id.startsWith('hl-')) {
    return s.replace(/==(?:yellow|green|red|blue):/g, '==').replace(/==/g, '');
  }
  if (id === 'bold')   return s.replace(/\*\*/g, '');
  if (id === 'italic') return s.replace(/(?<!\*)\*(?!\*)/g, '');
  if (id === 'strike') return s.replace(/~~/g, '');
  if (id === 'code')   return s.replace(/`/g, '');
  return s;
}

function buildFormatList() {
  return [
    { id: 'bold',      label: 'bold',          ico: 'B', desc: '**text**' },
    { id: 'italic',    label: 'italic',        ico: 'I', desc: '*text*' },
    { id: 'strike',    label: 'strikethrough', ico: 'S', desc: '~~text~~' },
    { id: 'code',      label: 'inline code',   ico: '`', desc: '`text`' },
    { id: 'hl-yellow', label: 'highlight',     ico: '▮', icoClass: 'hl-yellow' },
    { id: 'hl-green',  label: 'highlight green', ico: '▮', icoClass: 'hl-green' },
    { id: 'hl-red',    label: 'highlight red',   ico: '▮', icoClass: 'hl-red' },
    { id: 'hl-blue',   label: 'highlight blue',  ico: '▮', icoClass: 'hl-blue' },
  ];
}

function buildInsertList() {
  return [
    { id: 'code',      label: 'code block', ico: '▣', desc: 'python, sql, js...' },
    { id: 'checklist', label: 'checklist',  ico: '☑', desc: '- [ ] todo' },
    { id: 'heading',   label: 'heading',    ico: '#', desc: '# title' },
    { id: 'divider',   label: 'divider',    ico: '—', desc: '---' },
    { id: 'commands',  label: 'all commands...', ico: '⌘' },
    { id: 'help',      label: 'help', ico: '?', desc: 'commands, shortcuts & formatting' },
  ];
}

// Read-only reference shown by /help. Headings ({ heading }) render as non-interactive
// section dividers; every other row reuses the palette's icon/name/desc/kbd layout but
// executes nothing. The COMMANDS section is generated from buildCommandList() so it can
// never drift out of sync when commands are added or renamed.
function buildHelpList() {
  const commands = buildCommandList()
    .filter(c => c.id !== 'help')
    .map(c => ({ ico: c.ico, label: c.label, desc: c.desc }));

  return [
    { ico: '▚', label: 'byebyenotes', desc: 'a terminal-style notepad — your whole note lives in the URL, no account needed' },

    { heading: 'COMMANDS' },
    ...commands,

    { heading: 'SHORTCUTS' },
    { label: 'command palette',   kbd: '⌘K' },
    { label: 'copy link + share', kbd: '⌘⇧C' },
    { label: 'focus mode',        kbd: '⌘.' },
    { label: 'insert / format menu', kbd: '/' },
    { label: 'new line',          kbd: 'Enter' },
    { label: 'exit block',        kbd: '⇧Enter' },

    { heading: 'FORMATTING' },
    { ico: 'B', label: 'bold',          desc: '**text**' },
    { ico: 'I', label: 'italic',        desc: '*text*' },
    { ico: 'S', label: 'strikethrough', desc: '~~text~~' },
    { ico: '`', label: 'inline code',   desc: '`text`' },
    { ico: '▮', label: 'highlight',     desc: '==text== (or ==red: ==green: ==blue:)' },
    { ico: '#', label: 'heading',       desc: '# title' },
    { ico: '☑', label: 'checklist',     desc: '- [ ] todo' },
    { ico: '—', label: 'divider',       desc: '---' },
  ];
}

let paletteItems    = [];
let paletteFiltered = [];
let previewSnapshot = null;   // theme/font before live preview, to restore on cancel

function revertPreview() {
  if (!previewSnapshot) return;
  if (currentTheme !== previewSnapshot.theme) applyTheme(previewSnapshot.theme);
  if (currentFont  !== previewSnapshot.font)  applyFont(previewSnapshot.font);
  previewSnapshot = null;
}

function previewHighlighted() {
  if (paletteMode !== 'theme' && paletteMode !== 'font') return;
  const item = paletteFiltered[paletteIndex];
  if (!item) return;
  if (paletteMode === 'theme') applyTheme(item.id);
  else applyFont(item.id);
}

function openPalette(mode, opts = {}) {
  if (mode === 'theme' || mode === 'font') {
    if (!previewSnapshot) previewSnapshot = { theme: currentTheme, font: currentFont };
  } else {
    revertPreview();
  }
  paletteMode  = mode;
  paletteIndex = 0;
  paletteOpen  = true;
  if (opts.anchor !== undefined) paletteAnchor = opts.anchor;

  if (mode === 'command') {
    paletteAnchor = null;
    paletteTitle.textContent = 'Commands';
    paletteItems = buildCommandList();
  } else if (mode === 'help') {
    paletteAnchor = null;
    paletteTitle.textContent = 'Help';
    paletteItems = buildHelpList();
  } else if (mode === 'insert') {
    paletteTitle.textContent = 'Insert';
    paletteItems = buildInsertList();
  } else if (mode === 'format') {
    paletteTitle.textContent = 'Format selection';
    paletteItems = buildFormatList();
  } else if (mode === 'lang' || mode === 'changeLang') {
    paletteTitle.textContent = 'Language';
    paletteItems = LANGS.map(l => ({ id: l, label: l, icoSvg: langIcon(l) }));
  } else if (mode === 'font') {
    paletteTitle.textContent = 'Font';
    paletteItems = FONTS.map(f => ({ id: f, label: FONT_LABELS[f], current: f === currentFont }));
  } else if (mode === 'theme') {
    paletteTitle.textContent = 'Theme';
    paletteItems = sortThemesByMode(THEMES).map(t => ({
      id: t,
      label: t,
      ico: themeMode(t) === 'light' ? '☀' : '☾',
      current: t === currentTheme,
    }));
  } else if (mode === 'export') {
    paletteTitle.textContent = 'Export as';
    paletteItems = [
      { id: 'md',   label: 'Markdown', hint: '.md'   },
      { id: 'pdf',  label: 'PDF',      hint: '.pdf'  },
      { id: 'docx', label: 'Word',     hint: '.docx' },
      { id: 'html', label: 'HTML',     hint: '.html' },
    ];
  } else if (mode === 'filename') {
    paletteTitle.textContent = 'Save as';
    paletteItems = [];
  } else if (mode === 'syncPhrase') {
    paletteTitle.textContent = 'Sync passphrase';
    paletteItems = [];
  } else if (mode === 'folder') {
    paletteTitle.textContent = 'Move to folder';
    const folders = [...new Set(loadSnapshots().map(s => (s.folder || '').trim()).filter(Boolean))].sort();
    paletteItems = [
      { id: '__none', label: 'no folder', ico: '—', desc: 'top level' },
      ...folders.map(f => ({ id: f, label: f + '/', ico: '▸' })),
    ];
  }

  paletteSearch.value       = '';
  paletteSearch.placeholder = mode === 'filename' ? 'enter filename...'
    : mode === 'syncPhrase' ? 'enter a passphrase (6+ chars)...'
    : mode === 'folder' ? 'pick, or type a new folder name...'
    : 'search...';
  renderPaletteList(paletteItems);
  paletteOverlay.classList.remove('hidden');
  // In theme/font mode the document is the preview — don't dim/blur it
  paletteOverlay.classList.toggle('preview', mode === 'theme' || mode === 'font');
  positionPalette();
  paletteSearch.focus();
  updateStatus();
}

function positionPalette() {
  if (paletteAnchor && window.innerWidth > 700) {
    paletteEl.classList.add('anchored');
    const rect = paletteEl.getBoundingClientRect();
    const w = rect.width || 340;
    const h = rect.height || 260;
    let x = Math.min(paletteAnchor.x, window.innerWidth - w - 12);
    let y = paletteAnchor.y + 8;
    if (y + h > window.innerHeight - 44) y = Math.max(12, paletteAnchor.y - h - 12);
    paletteEl.style.left = `${Math.max(12, x)}px`;
    paletteEl.style.top  = `${y}px`;
  } else {
    paletteEl.classList.remove('anchored');
    paletteEl.style.left = '';
    paletteEl.style.top  = '';
  }
}

function renderPaletteList(items) {
  paletteFiltered = items;
  paletteIndex = Math.min(paletteIndex, Math.max(0, items.length - 1));
  paletteList.innerHTML = '';
  items.forEach((item, i) => {
    const li = document.createElement('li');

    // /help section divider — a non-interactive label, no icon/desc/handler
    if (item.heading) {
      li.className = 'cmd-section';
      li.textContent = item.heading;
      paletteList.appendChild(li);
      return;
    }

    const ico = document.createElement('span');
    ico.className = 'cmd-ico';
    if (item.icoClass) ico.classList.add(item.icoClass);
    // icoSvg holds our own constant SVG markup (language logos) — safe to inline.
    if (item.icoSvg) ico.innerHTML = item.icoSvg;
    else ico.textContent = item.ico || '·';
    li.appendChild(ico);

    const name = document.createElement('span');
    name.className = 'cmd-name';
    name.textContent = item.label;
    li.appendChild(name);

    if (item.desc) {
      const desc = document.createElement('span');
      desc.className = 'cmd-desc';
      desc.textContent = item.desc;
      li.appendChild(desc);
    }

    const right = document.createElement('span');
    right.className = 'right';
    if (item.current) {
      const tag = document.createElement('span');
      tag.className = 'tag-current';
      tag.textContent = 'current';
      right.appendChild(tag);
    }
    if (item.hint) {
      const hint = document.createElement('span');
      hint.className = 'cmd-desc';
      hint.textContent = item.hint;
      right.appendChild(hint);
    }
    if (item.kbd) {
      const kbd = document.createElement('kbd');
      kbd.textContent = item.kbd;
      right.appendChild(kbd);
    }
    if (right.childNodes.length) li.appendChild(right);

    // /help rows are read-only reference — don't wire them to run anything
    if (paletteMode !== 'help') {
      li.addEventListener('mousedown', (e) => { e.preventDefault(); paletteIndex = i; confirmPalette(); });
    }
    paletteList.appendChild(li);
  });
  updatePaletteHighlight();
  positionPalette();
}

function filterPalette(query) {
  const q = query.toLowerCase().replace(/^\//, '');
  const filtered = q
    ? paletteItems.filter(item =>
        (item.label || '').toLowerCase().includes(q) ||
        (item.desc || '').toLowerCase().includes(q) ||
        (item.hint || '').toLowerCase().includes(q)
      )
    : paletteItems;
  paletteIndex = 0;
  renderPaletteList(filtered);
  previewHighlighted();
}

function closePalette() {
  // A block-anchored palette (/ insert, format, lang) was opened *into* a specific
  // block, so focus must return there on close — even on the start screen, where we
  // otherwise avoid grabbing focus for global palettes (Cmd+K command/theme/font).
  const wasAnchored = paletteAnchor !== null;
  revertPreview();
  paletteOpen = false;
  paletteMode = null;
  paletteAnchor = null;
  changeLangTarget = null;
  paletteOverlay.classList.add('hidden');
  paletteOverlay.classList.remove('preview');
  paletteEl.classList.remove('anchored');
  folderTarget = null;
  formatSel = null;
  if (activeBlockId !== null && (!emptyVisible || wasAnchored)) getContentEl(activeBlockId)?.focus();
  updateStatus();
}

// Where ESC lands from a given palette mode. Pure so it can be unit-tested;
// 'help' backs out to the command menu (matching themes/fonts) instead of dying.
function paletteEscTarget(mode, hasAnchor) {
  if (mode === 'command' || mode === 'insert' || mode === 'format') return 'close';
  if (mode === 'help') return 'command';
  if (mode === 'lang' && hasAnchor) return 'insert';
  return 'command';
}

// Run the ESC action for the current palette mode. Shared by the search-input
// key handler and the overlay-level guard, so ESC works even when focus has
// left the input (e.g. the long, read-only /help list).
function dispatchPaletteEsc() {
  const target = paletteEscTarget(paletteMode, paletteAnchor !== null);
  if (target === 'close') closePalette();
  else if (target === 'insert') openPalette('insert', { anchor: paletteAnchor });
  else openPalette('command');
}

function updatePaletteHighlight() {
  // /help is read-only — no selectable/active row.
  if (paletteMode === 'help') return;
  Array.from(paletteList.children).forEach((li, i) => {
    li.classList.toggle('active', i === paletteIndex);
    if (i === paletteIndex) li.scrollIntoView({ block: 'nearest' });
  });
}

function insertSnippet(snippet) {
  closePalette();
  const content = activeBlockId !== null ? getContentEl(activeBlockId) : null;
  if (!content) return;
  content.focus();
  document.execCommand('insertText', false, snippet);
}

function confirmPalette() {
  if (!paletteMode) return;

  // /help is read-only — Enter just dismisses it
  if (paletteMode === 'help') { closePalette(); return; }

  // Filename mode — read directly from search input, no list needed
  if (paletteMode === 'filename') {
    const filename = paletteSearch.value.trim() || 'notes';
    closePalette();
    if (pendingExport === 'newNote') {
      exportHtmlAs(filename);
      newNote();
    } else if (pendingExport === 'md')   exportMd(filename);
    else if (pendingExport === 'pdf')    exportPdf(filename);
    else if (pendingExport === 'docx')   exportDocx(filename);
    else if (pendingExport === 'html')   exportHtmlAs(filename);
    pendingExport = null;
    return;
  }

  if (paletteMode === 'syncPhrase') {
    const phrase = paletteSearch.value.trim();
    if (phrase.length < 6) {
      paletteTitle.textContent = 'Sync passphrase — too short, use 6+ chars';
      return;
    }
    closePalette();
    enableSync(phrase);
    return;
  }

  if (paletteMode === 'format') {
    if (paletteFiltered.length === 0) return;
    const id = paletteFiltered[paletteIndex]?.id;
    const markers = FORMAT_MARKERS[id];
    const fs = formatSel;
    closePalette();
    if (markers && fs && fs.range) {
      // A block that already has markdown hides its editable layer when blurred;
      // re-show and focus it before restoring the selection, or execCommand no-ops.
      const blockEl = getBlockEl(fs.blockId);
      const el = getContentEl(fs.blockId);
      if (blockEl && el) {
        activeBlockId = fs.blockId;
        blockEl.classList.add('active', 'editing');
        el.focus();
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(fs.range);
        // Strip same-category markers first so re-formatting a region is uniform, not nested
        const cleaned = stripFormatting(fs.range.toString(), id);
        document.execCommand('insertText', false, markers[0] + cleaned + markers[1]);
      }
    }
    return;
  }

  if (paletteMode === 'folder') {
    const typed    = paletteSearch.value.trim().replace(/\/+$/, '');
    const selected = paletteFiltered[paletteIndex];
    const value    = selected ? (selected.id === '__none' ? null : selected.id) : (typed || null);
    const target   = folderTarget;
    closePalette();
    if (target !== null) assignFolder(target, value);
    return;
  }

  if (paletteFiltered.length === 0) return;
  const selected = paletteFiltered[paletteIndex];
  if (!selected) return;

  if (paletteMode === 'command') {
    if (selected.id === 'box') { openPalette('lang'); return; }
    if (selected.id === 'share') { closePalette(); openShare(); return; }
    if (selected.id === 'focus') { closePalette(); toggleFocus(); return; }
    if (selected.id === 'sync') {
      if (syncKey) { closePalette(); disableSync(); }
      else openPalette('syncPhrase');
      return;
    }
    if (selected.id === 'home') {
      closePalette();
      syncNow();               // make sure the current note lands in recents
      if (focusMode) toggleFocus();
      newNote();
      maybeShowEmptyState();
      return;
    }
    if (selected.id === 'newNote') {
      if (saveBeforeNew) {
        pendingExport = 'newNote';
        openPalette('filename');
      } else {
        closePalette();
        newNote();
      }
      return;
    }
    if (selected.id === 'saveBeforeNew') {
      saveBeforeNew = !saveBeforeNew;
      closePalette();
      return;
    }
    if (selected.id === 'delete') {
      closePalette();
      deleteBlock(activeBlockId);
      return;
    }
    openPalette(selected.id);
    return;
  }

  if (paletteMode === 'insert') {
    if (selected.id === 'code')      { openPalette('lang', { anchor: paletteAnchor }); return; }
    if (selected.id === 'checklist') { insertSnippet('- [ ] '); return; }
    if (selected.id === 'heading')   { insertSnippet('# '); return; }
    if (selected.id === 'commands')  { openPalette('command'); return; }
    if (selected.id === 'help')      { openPalette('help'); return; }
    if (selected.id === 'divider') {
      closePalette();
      const content = activeBlockId !== null ? getContentEl(activeBlockId) : null;
      if (content) {
        content.innerText = '---';
        syncMarkdown(activeBlockId);
        const newText = createBlock('text');
        insertBlockAfter(activeBlockId, newText);
        focusBlock(newText.id, false);
        scheduleSync();
      }
      return;
    }
    return;
  }

  if (paletteMode === 'lang') {
    const lang = selected.id;
    const active = getBlockData(activeBlockId);
    closePalette();
    if (active && active.type === 'text' && !(getBlockText(active) || '').trim()) {
      // Empty text block → become the code block instead of leaving a stub behind
      convertToCode(active.id, lang);
      focusBlock(active.id, false);
    } else {
      const newBlock = createBlock('code', lang);
      insertBlockAfter(activeBlockId, newBlock);
      focusBlock(newBlock.id, false);
    }
    scheduleSync();
  } else if (paletteMode === 'changeLang') {
    const block = getBlockData(changeLangTarget);
    if (block && block.type === 'code') {
      block.lang = selected.id;
      const badge = getBlockEl(block.id)?.querySelector('.lang-badge');
      if (badge) badge.innerHTML = langBadgeHtml(block.lang);
      syncHighlight(block.id);
      scheduleSync();
    }
    closePalette();
  } else if (paletteMode === 'font') {
    previewSnapshot = null;   // committing — don't revert on close
    applyFont(selected.id);
    savePrefs();
    closePalette();
    scheduleSync();
  } else if (paletteMode === 'theme') {
    previewSnapshot = null;   // committing — don't revert on close
    applyTheme(selected.id);
    savePrefs();
    closePalette();
    scheduleSync();
  } else if (paletteMode === 'export') {
    pendingExport = selected.id;
    openPalette('filename');
  }
  updateStatus();
}

// ── URL state, sync & status ──────────────────────────────────────────────────
function collectState() {
  blocks.forEach(b => { b.content = getBlockText(b); });
  return {
    nid: noteId,
    blocks: blocks.map(b => ({ type: b.type, content: b.content, lang: b.lang })),
    font:  currentFont,
    theme: currentTheme,
  };
}

function buildShareUrl() {
  return window.location.origin + window.location.pathname + '#' + encodeState(collectState());
}

// ── Tiny URL sharing ──────────────────────────────────────────────────────────
// A tiny link stores the note hash server-side (api/tiny) under a short id with a TTL.
const TINY_ID_RE = /^[a-z0-9]{6,12}$/;
const TINY_EXPIRY = [
  { ttl: 86400, label: '24hr'  },   // default — first
  { ttl: 21600, label: '6hr'   },
  { ttl: 1800,  label: '30min' },
  { ttl: 60,    label: '1min'  },
];

// A tiny-share path is exactly /s/<id>. Returns the validated id, or null for any other
// path (so normal notes / index.html fall through to the usual hash loading).
function parseTinyId(pathname) {
  const m = /^\/s\/([^/]+)\/?$/.exec(pathname || '');
  return m && TINY_ID_RE.test(m[1]) ? m[1] : null;
}

function tinyExpiryLabel(ttl) {
  return (TINY_EXPIRY.find(o => o.ttl === ttl) || TINY_EXPIRY[0]).label;
}

function hasContent() {
  return blocks.length > 1 ||
         blocks.some(b => b.type === 'code') ||
         blocks.some(b => (getBlockText(b) || '').trim() !== '');
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, SYNC_DELAY);
}

function syncNow() {
  clearTimeout(syncTimer);
  const state = collectState();
  if (hasContent()) {
    const hash = encodeState(state);
    history.replaceState(null, '', window.location.pathname + '#' + hash);
    lastUrlLen = (window.location.origin + window.location.pathname + '#' + hash).length;
    const langs = [...new Set(state.blocks.filter(b => b.lang).map(b => b.lang))];
    saveSnapshot({
      nid: noteId,
      hash,
      title: noteTitle(state.blocks),
      blockCount: state.blocks.length,
      langs,
      t: Date.now(),
    });
  } else {
    history.replaceState(null, '', window.location.pathname);
    lastUrlLen = 0;
  }
  updateCapacityUI();
}

function updateCapacityUI() {
  const { ratio, level } = capacityLevel(lastUrlLen);
  statusUrlFill.style.width = `${Math.max(ratio * 100, lastUrlLen ? 4 : 0)}%`;
  statusUrlText.textContent = `${(lastUrlLen / 1000).toFixed(1)}k`;
  statusUrl.classList.toggle('amber', level === 'amber');
  statusUrl.classList.toggle('red', level === 'red');
}

function currentMode() {
  if (focusMode)   return 'focus';
  if (paletteOpen) return 'commands';
  if (shareOpen)   return 'share';
  return hasContent() ? 'editing' : 'ready';
}

function updateStatus() {
  statusMode.textContent = currentMode();
  const idx = blocks.findIndex(b => b.id === activeBlockId);
  const active = idx !== -1 ? blocks[idx] : null;
  const kind = active ? (active.type === 'code' ? active.lang : 'text') : 'text';
  statusLang.textContent = active ? `${idx + 1}/${blocks.length} · ${kind}` : `${blocks.length} blocks`;
  statusFont.textContent = FONT_LABELS[currentFont].toLowerCase();
}

function flashCopied(msg) {
  statusCopied.textContent = msg;
  statusCopied.classList.add('visible');
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => statusCopied.classList.remove('visible'), 1500);
}

function copyShareLink() {
  const url = shareTinyUrl || buildShareUrl();
  navigator.clipboard.writeText(url).then(() => flashCopied('link copied ✓'));
}

// ── Share panel ───────────────────────────────────────────────────────────────
// POST the note hash to api/tiny and return the short URL, or null if the store is
// unavailable (503/offline/error) so the caller can fall back to the full-hash link.
async function createTiny(hash, ttl) {
  try {
    const r = await fetch('/api/tiny', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash, ttl }),
    });
    if (!r.ok) return null;
    const { id } = await r.json();
    return (typeof id === 'string' && TINY_ID_RE.test(id)) ? window.location.origin + '/s/' + id : null;
  } catch (e) {
    return null;
  }
}

function paintShareUrl(url, isFull) {
  const hashIdx = url.indexOf('#');
  shareLinkEl.innerHTML = (isFull && hashIdx !== -1)
    ? `${escapeHtml(url.slice(0, hashIdx + 1))}<span class="hl">${escapeHtml(url.slice(hashIdx + 1, hashIdx + 220))}</span>`
    : `<span class="hl">${escapeHtml(url)}</span>`;

  shareQr.innerHTML = '';
  if (typeof QRCode !== 'undefined' && url.length <= QR_MAX_CHARS) {
    new QRCode(shareQr, { text: url, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.L });
  } else {
    const msg = document.createElement('div');
    msg.className = 'qr-too-big';
    msg.textContent = url.length > QR_MAX_CHARS
      ? 'note too large for a QR code — copy the link instead'
      : 'qr unavailable';
    shareQr.appendChild(msg);
  }
}

function openShare() {
  syncNow();
  shareOpen = true;
  shareOverlay.classList.remove('hidden');

  // The capacity meter always reflects the note's own size (the full-hash URL),
  // regardless of whether we end up sharing a tiny link or the full one.
  const fullUrl = buildShareUrl();
  const { ratio, level } = capacityLevel(fullUrl.length);
  capFill.style.width = `${Math.max(ratio * 100, 3)}%`;
  capText.textContent = `${(fullUrl.length / 1000).toFixed(1)}k / ${URL_SAFE_LIMIT / 1000}k safe limit`;
  shareCard.classList.toggle('amber', level === 'amber');
  shareCard.classList.toggle('red', level === 'red');

  updateStatus();
  renderShareLink(fullUrl);
}

// Uploads the note at the selected expiry and shows the tiny URL + QR; on failure falls
// back to the full-hash link. Re-run when the expiry changes.
async function renderShareLink(fullUrl) {
  const ttl = Number(shareTtlEl && shareTtlEl.value) || TINY_EXPIRY[0].ttl;
  // Lock the selector and stamp this request, so a fast expiry change can't race: a
  // superseded upload resolving late must not repaint over the newer one's result.
  const token = ++shareReq;
  if (shareTtlEl) shareTtlEl.disabled = true;
  shareFootMsg.innerHTML = '&nbsp;&nbsp;preparing a shareable link…';
  shareLinkEl.textContent = '';
  shareQr.innerHTML = '';

  const hash = fullUrl.slice(fullUrl.indexOf('#') + 1);
  const tiny = await createTiny(hash, ttl);
  if (!shareOpen || token !== shareReq) return;   // closed, or superseded by a newer request

  if (tiny) {
    shareTinyUrl = tiny;
    if (shareTtlEl) shareTtlEl.disabled = false;   // re-enable for the next change
    paintShareUrl(tiny, false);
    shareFootMsg.innerHTML = `&nbsp;&nbsp;stored on the server · expires in ${escapeHtml(tinyExpiryLabel(ttl))}`;
  } else {
    shareTinyUrl = fullUrl;
    if (shareTtlEl) shareTtlEl.disabled = true;    // no server → expiry is meaningless
    paintShareUrl(fullUrl, true);
    shareFootMsg.innerHTML = '&nbsp;&nbsp;server unavailable — sharing the full link';
  }
}

function closeShare() {
  shareOpen = false;
  shareOverlay.classList.add('hidden');
  if (activeBlockId !== null) getContentEl(activeBlockId)?.focus();
  updateStatus();
}

// ── Focus mode ────────────────────────────────────────────────────────────────
function toggleFocus() {
  focusMode = !focusMode;
  document.body.classList.toggle('focus-mode', focusMode);
  if (focusMode) centerActiveBlock();
  updateStatus();
}

function centerActiveBlock() {
  if (activeBlockId === null) return;
  getBlockEl(activeBlockId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// ── Empty state ───────────────────────────────────────────────────────────────
const EXAMPLE_STATE = {
  nid: 'example',
  font: 'jetbrains-mono',
  theme: 'monokai',
  blocks: [
    { type: 'text', lang: null, content: '# Welcome to byebyenotes\n\nThis whole note — text, code, theme — lives **entirely in this URL**. No account, no server: the link *is* the save button.' },
    { type: 'text', lang: null, content: '## Try it\n\n- type `/` in an empty block to insert things\n- [x] open the example\n- [ ] press ⌘⇧C to see the share panel\n- [ ] run `/focus` for distraction-free writing' },
    { type: 'code', lang: 'python', content: 'def bsearch(a, x):\n    lo, hi = 0, len(a) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if a[mid] == x:\n            return mid\n        if a[mid] < x:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1' },
    { type: 'text', lang: null, content: '---\n\nEdit anything, then check your address bar — the URL already changed.' },
  ],
};

function maybeShowEmptyState() {
  const fresh = !window.location.hash && !hasContent();
  if (fresh) {
    renderRecent();
    emptyState.classList.remove('hidden', 'dissolving');
    emptyVisible = true;
  } else {
    emptyState.classList.add('hidden');
    emptyVisible = false;
  }
}

function dissolveEmptyState() {
  if (!emptyVisible) return;
  emptyVisible = false;
  clearHomeNav();
  emptyState.classList.add('dissolving');
  setTimeout(() => emptyState.classList.add('hidden'), 380);
}

// ── Home-screen keyboard navigation ───────────────────────────────────────────
// Live list of keyboard-navigable Home rows (recent notes + folder headers), in
// on-screen order. Collapsed folders hide their children, so those aren't listed.
function homeNavRows() {
  return Array.from(recentList.querySelectorAll('.recent-item, .recent-folder'));
}

function applyHomeNavHighlight() {
  const rows = homeNavRows();
  rows.forEach((el, i) => el.classList.toggle('kb-active', i === homeNavIndex));
  if (homeNavIndex >= 0 && rows[homeNavIndex]) {
    rows[homeNavIndex].scrollIntoView({ block: 'nearest' });
  }
}

function clearHomeNav() {
  homeNavIndex = -1;
  homeNavRows().forEach(el => el.classList.remove('kb-active'));
}

function moveHomeNav(key) {
  homeNavIndex = nextNavIndex(homeNavIndex, key, homeNavRows().length);
  applyHomeNavHighlight();
}

// Enter on the selected row: open a note, or toggle a folder — by reusing each
// row's own click handler, so there's a single source of truth per row type.
function activateHomeNav() {
  homeNavRows()[homeNavIndex]?.click();
}

function makeRecentRow(s) {
  const item = document.createElement('div');
  item.className = 'recent-item';
  const langs = (s.langs || []).length
    ? ` · <b>${escapeHtml(s.langs.join(', '))}</b>`
    : '';
  item.innerHTML = `
    <span class="ri-ico">▸</span>
    <span class="ri-name">${escapeHtml(s.title || 'untitled')}</span>
    <span class="ri-langs">${s.blockCount} block${s.blockCount === 1 ? '' : 's'}${langs}</span>
    <span class="ri-time">${timeAgo(s.t)}</span>
    <button class="ri-folder" aria-label="move to folder" data-tip="move to folder"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/></svg></button>
    <button class="ri-del" title="remove from recent notes">✕</button>`;
  item.addEventListener('click', (e) => {
    if (e.target.closest('.ri-del')) {
      deleteSnapshot(s.nid);
      return;
    }
    if (e.target.closest('.ri-folder')) {
      folderTarget = s.nid;
      openPalette('folder');
      return;
    }
    dissolveEmptyState();
    window.location.hash = s.hash;
  });
  return item;
}

function renderRecent() {
  const snaps = loadSnapshots();
  recentList.innerHTML = '';
  if (!snaps.length) {
    recentSection.classList.add('hidden');
    return;
  }
  recentSection.classList.remove('hidden');
  const { loose, folders } = groupByFolder(snaps);

  loose.slice(0, 6).forEach(s => recentList.appendChild(makeRecentRow(s)));

  folders.forEach(([name, items]) => {
    const collapsed = collapsedFolders.has(name);
    const head = document.createElement('div');
    head.className = 'recent-folder';
    head.innerHTML = `
      <span class="rf-caret">${collapsed ? '▸' : '▾'}</span>
      <span class="rf-name">${escapeHtml(name)}/</span>
      <span class="rf-count">${items.length}</span>`;
    head.addEventListener('click', () => {
      if (collapsed) collapsedFolders.delete(name);
      else collapsedFolders.add(name);
      renderRecent();
    });
    recentList.appendChild(head);
    if (!collapsed) {
      items.forEach(s => {
        const row = makeRecentRow(s);
        row.classList.add('in-folder');
        recentList.appendChild(row);
      });
    }
  });

  // Rows were rebuilt: drop a now-out-of-range selection, else re-paint it.
  if (homeNavIndex >= homeNavRows().length) homeNavIndex = -1;
  applyHomeNavHighlight();
}

// Rewrite an image markdown line after a drag (place/tilt) or resize
function updateImageLine(blockId, lineIdx, changes) {
  const block = getBlockData(blockId);
  if (!block) return;
  const lines = getBlockText(block).split('\n');
  const m = (lines[lineIdx] || '').match(/^!\[([^\]]*?)(?:\|(\d{2,4}))?(?:\|(left|center|right|pos:-?[\d.]+,-?\d+,-?\d+))?\]\((https?:\/\/\S+)\)\s*$/);
  if (!m) return;
  const width = changes.width ?? (m[2] ? Number(m[2]) : null);
  let place = changes.pos
    ? `pos:${changes.pos.x},${changes.pos.y},${changes.pos.r}`
    : (changes.align ?? m[3] ?? null);
  let head = m[1];
  if (width) head += `|${width}`;
  if (place && place !== 'left' && width) head += `|${place}`;
  lines[lineIdx] = `![${head}](${m[4]})`;
  block.content = lines.join('\n');
  const contentEl = getContentEl(blockId);
  if (contentEl) contentEl.innerText = block.content;
  syncMarkdown(blockId);
  scheduleSync();
}

// ── Pasted images (compressed client-side, stored via /api/img) ───────────────
async function uploadPastedImage(file, blockId) {
  flashCopied('uploading image…');
  try {
    // Downscale to keep uploads small — 1200px is plenty for a note
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.8));
    const b64 = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result.split(',')[1]);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });

    const res = await fetch('/api/img', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: blob.type, data: b64 }),
    });
    if (!res.ok) throw new Error('upload failed');
    const { id } = await res.json();

    focusBlock(blockId, true);
    document.execCommand('insertText', false,
      `![image|480](${window.location.origin}/api/img?id=${id})`);
    flashCopied('image added ✓');
  } catch (e) {
    flashCopied('image upload failed — needs the deployed site + KV');
  }
}

// ── Export ────────────────────────────────────────────────────────────────────
function markdownString() {
  return blocks.map(b => {
    const text = getBlockText(b);
    return b.type === 'code'
      ? '```' + (b.lang || '') + '\n' + text + '\n```'
      : text;
  }).join('\n\n');
}

function blocksToHtml() {
  return blocks.map(b => {
    const text = getBlockText(b);
    if (b.type === 'code') {
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre><code>${escaped}</code></pre>`;
    }
    return text.split('\n').map(line => {
      const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<p>${escaped || '&nbsp;'}</p>`;
    }).join('');
  }).join('');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportMd(filename = 'notes') {
  downloadBlob(new Blob([markdownString()], { type: 'text/markdown' }), filename + '.md');
}

function exportPdf(filename = 'notes') {
  const html    = blocksToHtml();
  const fontCss = FONT_CSS[currentFont];
  const win     = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=IBM+Plex+Mono:wght@400;500&family=JetBrains+Mono:wght@400;500&family=Roboto+Mono:wght@400;500&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      body { font-family: ${fontCss}; font-size: 14px; line-height: 1.6; padding: 40px 60px; color: #222; }
      pre  { background: #f4f4f4; padding: 12px; white-space: pre-wrap; word-wrap: break-word; border-left: 3px solid #888; margin: 8px 0; }
      p    { margin: 0 0 4px; white-space: pre-wrap; }
    </style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  win.document.fonts.ready.then(() => win.print());
}

function exportHtmlAs(filename) {
  const hash    = encodeState(collectState());
  const siteUrl = 'https://byebyenotes.vercel.app';
  const html    = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <script>window.location.replace('${siteUrl}/#${hash}');<\/script>
</head>
<body>Opening byebyenotes...</body>
</html>`;
  downloadBlob(new Blob([html], { type: 'text/html' }), filename + '.html');
}

function newNote() {
  noteId = Math.random().toString(36).slice(2, 10);
  blocks = [createBlock('text')];
  renderAllBlocks();
  history.replaceState(null, '', window.location.pathname);
  lastUrlLen = 0;
  updateCapacityUI();
  focusBlock(blocks[0].id, false);
  updateStatus();
}

function exportDocx(filename = 'notes') {
  const fontCss  = FONT_CSS[currentFont];
  const fullHtml = `<!DOCTYPE html><html><head><style>
    body { font-family: ${fontCss}; font-size: 14px; line-height: 1.6; }
    pre  { font-family: ${fontCss}; background: #f4f4f4; padding: 8px; }
  </style></head><body>${blocksToHtml()}</body></html>`;
  const blob = htmlDocx.asBlob(fullHtml);
  downloadBlob(blob, filename + '.docx');
}

// ── Event handling ────────────────────────────────────────────────────────────
function getCaretOffset(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return 0;
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
  return range.toString().length;
}

function isCaretAtStart(el) {
  return getCaretOffset(el) === 0;
}

function isCaretAtEnd(el) {
  return getCaretOffset(el) === (el.innerText || '').length;
}

function caretPoint(fallbackEl) {
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (r && (r.top || r.left || r.width || r.height)) return { x: r.left, y: r.bottom };
  }
  if (fallbackEl) {
    const r = fallbackEl.getBoundingClientRect();
    return { x: r.left + 14, y: r.top + 28 };
  }
  return null;
}

function handleBlockAction(act, blockId) {
  const block = getBlockData(blockId);
  if (!block) return;
  if (act === 'up')   moveBlock(blockId, -1);
  if (act === 'down') moveBlock(blockId, 1);
  if (act === 'del')  deleteBlock(blockId);
  if (act === 'add') {
    const newBlock = createBlock('text');
    insertBlockAfter(blockId, newBlock);
    focusBlock(newBlock.id, false);
    scheduleSync();
  }
  if (act === 'copy') {
    navigator.clipboard.writeText(getBlockText(block)).then(() => flashCopied('block copied ✓'));
  }
}

function attachEvents() {

  // ── Global shortcuts ──
  document.addEventListener('keydown', (e) => {
    // Esc — close share, else exit focus mode (palette handles its own esc)
    if (e.key === 'Escape' && !paletteOpen) {
      if (shareOpen) { e.preventDefault(); closeShare(); return; }
      if (focusMode) { e.preventDefault(); toggleFocus(); return; }
    }

    if (shareOpen || paletteOpen) return;

    // Home-screen recent-list navigation (only while the empty state is up).
    if (emptyVisible) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveHomeNav(e.key);
        return;
      }
      if (homeNavIndex >= 0) {
        if (e.key === 'Enter')  { e.preventDefault(); activateHomeNav(); return; }
        if (e.key === 'Escape') { e.preventDefault(); clearHomeNav(); return; }
        // While a row is selected, swallow printable keys so they don't leak into
        // the focused block and dissolve the Home screen — browsing ≠ new note.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          return;
        }
      }
    }

    // Ctrl/Cmd+Shift+C — copy link + open share panel
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      copyShareLink();
      openShare();
      return;
    }

    // Ctrl/Cmd+K — command palette from anywhere
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      openPalette('command');
      return;
    }

    // Ctrl/Cmd+. — toggle focus mode
    if ((e.ctrlKey || e.metaKey) && e.key === '.') {
      e.preventDefault();
      toggleFocus();
      return;
    }

    // / with no block focused — focus a block and open the same caret palette
    // as in-block, so / is always the inline insert/format menu (never bottom-left)
    if (e.key === '/' && !e.target.closest('.block-content') && e.target !== paletteSearch) {
      e.preventDefault();
      const id = (activeBlockId !== null && getBlockEl(activeBlockId)) ? activeBlockId : blocks[0]?.id;
      if (id !== undefined && id !== null) {
        focusBlock(id, true);
        openPalette('insert', { anchor: caretPoint(getContentEl(id)) });
      } else {
        openPalette('command');
      }
    }
  });

  // ── Palette ──
  paletteSearch.addEventListener('input', () => {
    filterPalette(paletteSearch.value);
  });

  paletteSearch.addEventListener('keydown', (e) => {
    const count = paletteFiltered.length;
    if (e.key === 'ArrowDown' && count) {
      e.preventDefault();
      paletteIndex = (paletteIndex + 1) % count;
      updatePaletteHighlight();
      previewHighlighted();
    } else if (e.key === 'ArrowUp' && count) {
      e.preventDefault();
      paletteIndex = (paletteIndex - 1 + count) % count;
      updatePaletteHighlight();
      previewHighlighted();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirmPalette();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dispatchPaletteEsc();
    }
  });

  // ESC also has to work when focus isn't on the search input — e.g. inside the
  // long, read-only /help list, where clicking a row blurs the input and focus
  // falls to <body>, so a keydown never reaches the input's handler above. Bind at
  // the document so ESC lands wherever focus went; skip the input (its own handler
  // above already dispatched) to avoid double-firing.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !paletteOpen || e.target === paletteSearch) return;
    e.preventDefault();
    dispatchPaletteEsc();
  });

  paletteOverlay.addEventListener('click', (e) => {
    if (e.target === paletteOverlay) closePalette();
  });

  // ── Share panel ──
  shareOverlay.addEventListener('click', (e) => {
    if (e.target === shareOverlay || e.target.closest('.share-head .esc')) closeShare();
  });
  document.getElementById('share-copy').addEventListener('click', (e) => {
    navigator.clipboard.writeText(shareTinyUrl || buildShareUrl()).then(() => {
      e.target.textContent = 'copied ✓';
      setTimeout(() => { e.target.textContent = 'copy link'; }, 1200);
    });
  });
  // Re-upload at the newly chosen expiry and refresh the shown link + QR.
  shareTtlEl.addEventListener('change', () => { if (shareOpen) renderShareLink(buildShareUrl()); });
  document.getElementById('share-copy-md').addEventListener('click', (e) => {
    navigator.clipboard.writeText(markdownString()).then(() => {
      e.target.textContent = 'copied ✓';
      setTimeout(() => { e.target.textContent = 'copy markdown'; }, 1200);
    });
  });
  statusUrl.addEventListener('click', () => { if (!shareOpen) openShare(); });

  // ── FAB ──
  fab.addEventListener('click', () => {
    if (paletteOpen) closePalette();
    else openPalette('command');
  });

  // ── Empty state ──
  // Keep the underlying block focused when clicking neutral areas, so typing
  // always registers and / always resolves the same way.
  const EMPTY_INTERACTIVE = '.hint-card, #example-link, .recent-item, .recent-folder, .ri-folder, .ri-del, .creator-credit, a, button';
  emptyState.addEventListener('mousedown', (e) => {
    if (e.target.closest(EMPTY_INTERACTIVE)) return;
    e.preventDefault();   // don't blur the focused block
    if (activeBlockId === null || !getBlockEl(activeBlockId)) {
      if (blocks[0]) focusBlock(blocks[0].id, false);
    }
  });

  emptyState.addEventListener('click', (e) => {
    const card = e.target.closest('.hint-card');
    if (card) {
      const hint = card.dataset.hint;
      if (hint === 'palette') { openPalette('command'); return; }
      if (hint === 'box')     { focusBlock(blocks[0].id, false); openPalette('lang'); return; }
      if (hint === 'share')   { openShare(); return; }
      if (hint === 'focus')   { dissolveEmptyState(); focusBlock(blocks[0].id, false); toggleFocus(); return; }
    }
    if (e.target.closest('#example-link') || e.target.closest('.recent-item') || e.target.closest('.creator-credit')) return;
    focusBlock(blocks[0].id, false);
  });

  exampleLink.addEventListener('click', () => dissolveEmptyState());

  // ── URL navigation (example link, recent notes, pasted links) ──
  window.addEventListener('hashchange', () => {
    loadState();
    maybeShowEmptyState();
  });

  // ── Block-level events (delegated from docContainer) ──
  docContainer.addEventListener('focusin', (e) => {
    const content = e.target.closest('.block-content');
    if (!content) return;
    activeBlockId = getBlockIdFromEl(content);
    docContainer.querySelectorAll('.block.active, .block.editing').forEach(el => el.classList.remove('active', 'editing'));
    content.closest('.block')?.classList.add('active', 'editing');
    if (focusMode) centerActiveBlock();
    updateStatus();
  });

  docContainer.addEventListener('focusout', (e) => {
    const content = e.target.closest('.block-content');
    if (!content) return;
    const id = getBlockIdFromEl(content);
    const block = getBlockData(id);
    if (block) block.content = content.innerText || '';   // capture while still visible
    content.closest('.block')?.classList.remove('editing');
    if (block?.type === 'text') syncMarkdown(id);
  });

  docContainer.addEventListener('mousedown', (e) => {
    // Keep focus in the editor when clicking block controls
    if (e.target.closest('.gutter') || e.target.closest('.touch-tools') || e.target.closest('.code-head')) {
      e.preventDefault();
    }
  });

  docContainer.addEventListener('click', (e) => {
    const actBtn = e.target.closest('.gutter button, .touch-tools button, .head-actions button');
    if (actBtn) {
      handleBlockAction(actBtn.dataset.act, getBlockIdFromEl(actBtn));
      return;
    }

    const badge = e.target.closest('.lang-badge');
    if (badge) {
      changeLangTarget = getBlockIdFromEl(badge);
      openPalette('changeLang');
      return;
    }

    const cb = e.target.closest('.md-check .cb');
    if (cb) {
      const id = getBlockIdFromEl(cb);
      const block = getBlockData(id);
      const lineIdx = Number(cb.closest('.md-check').dataset.line);
      block.content = toggleCheckboxLine(getBlockText(block), lineIdx);
      getContentEl(id).innerText = block.content;
      syncMarkdown(id);
      scheduleSync();
      return;
    }

    if (e.target.closest('.md-img')) return;   // image clicks/drags never open raw editing

    const layer = e.target.closest('.md-layer');
    if (layer) {
      focusBlock(getBlockIdFromEl(layer), true);
    }
  });

  // ── Image drag: body → place (left/center/right), corner handle → resize ──
  let imgDrag = null;

  docContainer.addEventListener('pointerdown', (e) => {
    const resize = e.target.closest('.img-handle');
    const rotate = e.target.closest('.img-rotate');
    const img    = e.target.closest('.md-img img');
    if (!resize && !rotate && !img) return;
    const wrap = e.target.closest('.md-img');
    const box  = wrap.querySelector('.img-box');
    e.preventDefault();
    imgDrag = {
      mode: resize ? 'resize' : rotate ? 'rotate' : 'move',
      img: wrap.querySelector('img'),
      box,
      wrap,
      blockId: getBlockIdFromEl(wrap),
      lineIdx: Number(wrap.dataset.line),
      startX: e.clientX,
      startY: e.clientY,
      startW: wrap.querySelector('img').getBoundingClientRect().width,
      startLeft: parseFloat(box.style.left) || 0,     // % of wrapper width
      startTop:  parseFloat(box.style.top)  || 0,     // px
      startRot:  (box.style.transform.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/) || [])[1] * 1 || 0,
      moved: false,
    };
    imgDrag.img.classList.add('dragging');
  });

  document.addEventListener('pointermove', (e) => {
    if (!imgDrag) return;
    const d  = imgDrag;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    if (d.mode === 'resize') {
      const max = d.wrap.getBoundingClientRect().width;
      const w = Math.min(max, Math.max(80, Math.round(d.startW + dx)));
      d.img.style.width = w + 'px';
    } else if (d.mode === 'rotate') {
      const rot = Math.max(-45, Math.min(45, Math.round(d.startRot + dx * 0.35)));
      d.box.style.transform = `rotate(${rot}deg)`;
    } else {
      const wrapW = d.wrap.getBoundingClientRect().width || 1;
      const x = Math.max(-15, Math.min(95, d.startLeft + (dx / wrapW) * 100));
      d.box.style.left = `${x}%`;
      d.box.style.top  = `${d.startTop + dy}px`;
    }
  });

  const endImgDrag = () => {
    if (!imgDrag) return;
    const d = imgDrag;
    imgDrag = null;
    d.img.classList.remove('dragging');
    if (!d.moved) return;
    const width = Math.round(d.img.getBoundingClientRect().width);
    if (d.mode === 'resize') {
      updateImageLine(d.blockId, d.lineIdx, { width });
      return;
    }
    const pos = {
      x: Math.round((parseFloat(d.box.style.left) || 0) * 10) / 10,
      y: Math.round(parseFloat(d.box.style.top) || 0),
      r: Math.round((d.box.style.transform.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/) || [])[1] * 1 || 0),
    };
    updateImageLine(d.blockId, d.lineIdx, { pos, width });
  };
  document.addEventListener('pointerup', endImgDrag);
  document.addEventListener('pointercancel', endImgDrag);

  docContainer.addEventListener('keydown', (e) => {
    if (paletteOpen) return;
    const content = e.target.closest('.block-content');
    if (!content) return;
    const blockId   = getBlockIdFromEl(content);
    const blockData = getBlockData(blockId);
    const blockIdx  = blocks.findIndex(b => b.id === blockId);

    // Ctrl/Cmd+Shift+↑/↓ — reorder block
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveBlock(blockId, e.key === 'ArrowUp' ? -1 : 1);
      return;
    }

    // / behavior in a block:
    //  - text block with a selection → format palette
    //  - text block, caret at a word boundary (start of line or after a space) → insert palette
    //  - text block mid-word → literal slash (so "and/or" works)
    //  - code block → always literal slash (comments, paths, division, regex)
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const sel = window.getSelection();
      if (blockData.type === 'text' && sel && !sel.isCollapsed &&
          sel.toString().trim() && content.contains(sel.anchorNode)) {
        e.preventDefault();
        formatSel = { blockId, range: sel.getRangeAt(0).cloneRange() };
        openPalette('format', { anchor: caretPoint(content) });
        return;
      }
      if (blockData.type === 'text') {
        let before = '';
        if (sel && sel.rangeCount && sel.getRangeAt(0).collapsed) {
          const r = sel.getRangeAt(0);
          if (r.startContainer.nodeType === Node.TEXT_NODE) {
            before = r.startOffset > 0 ? r.startContainer.textContent[r.startOffset - 1] : '';
          }
        }
        if (before === '' || /\s/.test(before)) {
          e.preventDefault();
          openPalette('insert', { anchor: caretPoint(content) });
          return;
        }
      }
      // fall through: literal slash
    }

    // Auto-closing pairs in code blocks
    const PAIRS = { '(': ')', '[': ']', '{': '}', "'": "'", '"': '"' };
    if (blockData.type === 'code' && !e.ctrlKey && !e.metaKey && PAIRS[e.key]) {
      e.preventDefault();
      document.execCommand('insertText', false, e.key + PAIRS[e.key]);
      window.getSelection().modify('move', 'backward', 'character');
      syncHighlight(blockId);
      return;
    }

    // Skip over closing bracket if it's already there
    const CLOSING = new Set([')', ']', '}']);
    if (blockData.type === 'code' && CLOSING.has(e.key)) {
      const sel = window.getSelection();
      if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        if (range.collapsed) {
          const node = range.startContainer;
          const offset = range.startOffset;
          const nextChar = node.nodeType === Node.TEXT_NODE
            ? node.textContent[offset]
            : null;
          if (nextChar === e.key) {
            e.preventDefault();
            sel.modify('move', 'forward', 'character');
            return;
          }
        }
      }
    }

    // Enter in text block — stay in the block: continue lists, else insert a line break.
    // (Shift+Enter exits to a new block — see below.)
    if (e.key === 'Enter' && !e.shiftKey && blockData.type === 'text') {
      const sel   = window.getSelection();
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
      const node  = range?.collapsed ? range.startContainer : null;
      if (node && node.nodeType === Node.TEXT_NODE) {
        const upto   = node.textContent.slice(0, range.startOffset);
        const lastNL = upto.lastIndexOf('\n');
        const line   = lastNL === -1 ? upto : upto.slice(lastNL + 1);
        const check  = line.match(/^- \[[ xX]\] ?(.*)$/);
        const bullet = check ? null : line.match(/^- (.*)$/);
        if (check || bullet) {
          e.preventDefault();
          const rest = (check ? check[1] : bullet[1]).trim();
          if (rest) {
            document.execCommand('insertText', false, check ? '\n- [ ] ' : '\n- ');
          } else {
            // Enter on an empty marker line ends the list: clear the marker
            for (let i = 0; i < line.length; i++) sel.modify('extend', 'backward', 'character');
            document.execCommand('delete');
          }
          return;
        }
      }
      // Not in a list: Enter is a plain line break inside the block
      e.preventDefault();
      document.execCommand('insertText', false, '\n');
      return;
    }

    // Enter in code block — bracket expansion or auto-indent
    if (e.key === 'Enter' && !e.shiftKey && blockData.type === 'code') {
      e.preventDefault();
      const sel   = window.getSelection();
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
      const node  = range?.collapsed ? range.startContainer : null;
      const off   = range?.startOffset ?? 0;

      // In Chrome's contenteditable, each line is a <div> whose first child is a text node.
      // node.textContent.slice(0, off) reliably gives text on the current line up to cursor.
      const lineText = (node?.nodeType === Node.TEXT_NODE ? node.textContent : '');
      const lineUpToCursor = lineText.slice(0, off);
      const lastNL = lineUpToCursor.lastIndexOf('\n');
      const currentLine = lastNL === -1 ? lineUpToCursor : lineUpToCursor.slice(lastNL + 1);
      const indent = currentLine.match(/^(\s*)/)[1];

      const charBefore = lineText[off - 1] || '';
      const charAfter  = lineText[off]     || '';
      const BRACKET_PAIRS = { '(': ')', '[': ']', '{': '}' };

      if (charBefore && BRACKET_PAIRS[charBefore] === charAfter) {
        // Expand: cursor on indented inner line, closing bracket aligned with `(`
        const openCol       = currentLine.length - 1;
        const closingIndent = ' '.repeat(openCol);
        const cursorIndent  = ' '.repeat(openCol + 4);
        document.execCommand('insertText', false, '\n' + cursorIndent + '\n' + closingIndent);
        for (let i = 0; i < closingIndent.length + 1; i++) sel.modify('move', 'backward', 'character');
      } else if (currentLine.trimEnd().endsWith(':')) {
        // Python-style: indent one level deeper after colon
        document.execCommand('insertText', false, '\n' + indent + '    ');
      } else {
        // Auto-indent: match current line's leading whitespace
        document.execCommand('insertText', false, '\n' + indent);
      }
      syncHighlight(blockId);
      return;
    }

    // Shift+Enter in text block — exit to a new block (Enter now makes a line break)
    if (e.key === 'Enter' && e.shiftKey && blockData.type === 'text') {
      e.preventDefault();
      const nextBlock = blocks[blockIdx + 1];
      if (nextBlock && blocks[blockIdx] && !(getBlockText(blocks[blockIdx]) || '').trim()) {
        focusBlock(nextBlock.id, false);
      } else {
        const newText = createBlock('text');
        insertBlockAfter(blockId, newText);
        focusBlock(newText.id, false);
        scheduleSync();
      }
      return;
    }

    // Shift+Enter in code block — exit to next block (Enter is taken by newline+indent)
    if (e.key === 'Enter' && e.shiftKey && blockData.type === 'code') {
      e.preventDefault();
      const nextBlock = blocks[blockIdx + 1];
      if (nextBlock) {
        focusBlock(nextBlock.id, false);
      } else {
        const newText = createBlock('text');
        insertBlockAfter(blockId, newText);
        focusBlock(newText.id, false);
      }
      return;
    }

    // Tab — insert 4 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '    ');
      return;
    }

    // Backspace on empty block — delete it and focus previous (or next if first)
    if (e.key === 'Backspace') {
      const isEmpty = (content.innerText || '').trim() === '';
      if (isEmpty && blocks.length > 1) {
        e.preventDefault();
        deleteBlock(blockId);
        return;
      }
    }

    // Arrow navigation between blocks
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      if (isCaretAtEnd(content)) {
        const next = blocks[blockIdx + 1];
        if (next) {
          e.preventDefault();
          focusBlock(next.id, false);
          const nextContent = getContentEl(next.id);
          const range = document.createRange();
          range.setStart(nextContent, 0);
          range.collapse(true);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      if (isCaretAtStart(content)) {
        const prev = blocks[blockIdx - 1];
        if (prev) {
          e.preventDefault();
          focusBlock(prev.id, true);
        }
      }
    }
  });

  // Paste: real image data uploads to the image store; everything else lands as plain text
  docContainer.addEventListener('paste', (e) => {
    const content = e.target.closest('.block-content');
    if (!content) return;
    e.preventDefault();

    const blockId = getBlockIdFromEl(content);
    const imgItem = [...(e.clipboardData?.items || [])].find(it => it.type.startsWith('image/'));
    if (imgItem && getBlockData(blockId)?.type === 'text') {
      const file = imgItem.getAsFile();
      if (file) { uploadPastedImage(file, blockId); return; }
    }

    let text = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!text) return;
    // A bare image URL pasted into a text block becomes a markdown image
    const block = getBlockData(getBlockIdFromEl(content));
    if (block?.type === 'text' && /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg)(\?\S*)?$/i.test(text.trim())) {
      text = `![image](${text.trim()})`;
    }
    document.execCommand('insertText', false, text);
  });

  docContainer.addEventListener('input', (e) => {
    const content = e.target.closest('.block-content');
    if (!content) return;
    const blockId = getBlockIdFromEl(content);
    const block = getBlockData(blockId);
    if (block) block.content = content.innerText || '';
    if (block?.type === 'code') {
      syncHighlight(blockId);
      updateLineCount(blockId);
    }
    dissolveEmptyState();
    if (focusMode) centerActiveBlock();
    scheduleSync();
    updateStatus();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
function loadState() {
  const hash  = window.location.hash.slice(1);
  const state = decodeState(hash);

  if (state && Array.isArray(state.blocks) && state.blocks.length > 0) {
    currentFont  = FONTS.includes(state.font)   ? state.font  : 'jetbrains-mono';
    currentTheme = THEMES.includes(state.theme) ? state.theme : 'monokai';
    noteId = typeof state.nid === 'string' ? state.nid : Math.random().toString(36).slice(2, 10);
    // A note you've already made yours (it's in your own local/synced recents)
    // should look like your other notes — your current theme/font wins over
    // whatever was saved with it. A note you've never touched before (e.g. a
    // link someone else shared) still opens in the sender's chosen presentation.
    if (loadSnapshots().some(s => s.nid === noteId)) {
      const prefs = loadPrefs();
      if (THEMES.includes(prefs.theme)) currentTheme = prefs.theme;
      if (FONTS.includes(prefs.font))   currentFont  = prefs.font;
    }
    nextId = 0;
    blocks = state.blocks.map(b => {
      const block = createBlock(b.type, b.lang);
      block.content = b.content || '';
      return block;
    });
    lastUrlLen = (window.location.origin + window.location.pathname + '#' + hash).length;
  } else {
    noteId = Math.random().toString(36).slice(2, 10);
    blocks = [createBlock('text')];
    lastUrlLen = 0;
    // Fresh note: start in the user's preferred theme/font instead of the defaults
    const prefs = loadPrefs();
    if (THEMES.includes(prefs.theme)) currentTheme = prefs.theme;
    if (FONTS.includes(prefs.font))   currentFont  = prefs.font;
  }

  applyFont(currentFont);
  applyTheme(currentTheme);
  renderAllBlocks();
  updateCapacityUI();

  if (blocks.length > 0) focusBlock(blocks[0].id, false);
  updateStatus();
}

document.addEventListener('DOMContentLoaded', () => {
  docContainer   = document.getElementById('document-container');
  statusMode     = document.getElementById('status-mode');
  statusLang     = document.getElementById('status-lang');
  statusFont     = document.getElementById('status-font');
  statusUrl      = document.getElementById('status-url');
  statusUrlFill  = document.getElementById('status-url-fill');
  statusUrlText  = document.getElementById('status-url-text');
  statusHint     = document.getElementById('status-hint');
  statusCopied   = document.getElementById('status-copied');
  paletteOverlay = document.getElementById('palette-overlay');
  paletteEl      = document.getElementById('palette');
  paletteSearch  = document.getElementById('palette-search');
  paletteTitle   = document.getElementById('palette-title');
  paletteList    = document.getElementById('palette-list');
  emptyState     = document.getElementById('empty-state');
  recentSection  = document.getElementById('recent-section');
  recentList     = document.getElementById('recent-list');
  exampleLink    = document.getElementById('example-link');
  shareOverlay   = document.getElementById('share-overlay');
  shareCard      = document.getElementById('share-card');
  shareLinkEl    = document.getElementById('share-link');
  shareQr        = document.getElementById('share-qr');
  capFill        = document.getElementById('cap-fill');
  capText        = document.getElementById('cap-text');
  shareTtlEl     = document.getElementById('share-ttl');
  shareFootMsg   = document.getElementById('share-foot-msg');
  fab            = document.getElementById('fab');

  shareTtlEl.innerHTML = TINY_EXPIRY
    .map(o => `<option value="${o.ttl}">${o.label}</option>`).join('');

  statusHint.textContent = '/ insert · ⌘K commands · ⌘⇧C share · ⌘. focus';
  exampleLink.href = '#' + encodeState(EXAMPLE_STATE);

  try {
    const stored = localStorage.getItem(SYNC_KEY_LS);
    if (stored && /^[0-9a-f]{64}$/.test(stored)) syncKey = stored;
  } catch (e) {}

  attachEvents();

  // A /s/<id> path is a tiny share link — resolve it server-side before the normal
  // hash-based load. Any other path loads the note from location.hash as usual.
  const tinyId = parseTinyId(window.location.pathname);
  if (tinyId) {
    resolveTiny(tinyId);
  } else {
    loadState();
    maybeShowEmptyState();
  }
  updateStatus();

  if (syncKey) syncPull().catch(() => {});
});

// ── Tiny-link resolution (boot) ───────────────────────────────────────────────
function tinyStateEl() {
  let el = document.getElementById('tiny-state');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tiny-state';
    document.body.appendChild(el);
  }
  return el;
}
function showTinyLoading() {
  tinyStateEl().innerHTML = '<div class="ts-inner">opening shared link…</div>';
}
function showTinyMessage(msg) {
  tinyStateEl().innerHTML =
    `<div class="ts-inner"><p>${escapeHtml(msg)}</p><a href="/">start a new note →</a></div>`;
}
function clearTinyState() {
  const el = document.getElementById('tiny-state');
  if (el) el.remove();
}

async function resolveTiny(id) {
  showTinyLoading();
  try {
    const r = await fetch('/api/tiny?id=' + encodeURIComponent(id));
    if (r.status === 404) return showTinyMessage('this shared link has expired.');
    if (!r.ok)            return showTinyMessage('shared links need the server, which isn’t available right now.');
    const { hash } = await r.json();
    if (typeof hash !== 'string' || !decodeState(hash)) {
      return showTinyMessage('this shared link is invalid.');
    }
    clearTinyState();
    // Detach from the /s/<id> path into a normal hash note, so edits persist and a
    // refresh loads the note locally instead of re-fetching (and it's now theirs).
    // replaceState (not location.hash=) avoids firing the hashchange re-loader.
    history.replaceState(null, '', '/#' + hash);
    loadState();                   // reads location.hash and renders
    maybeShowEmptyState();
  } catch (e) {
    showTinyMessage('shared links need the server, which isn’t available right now.');
  }
}

// Next selection index for the Home-screen recent list. current === -1 means
// nothing selected; from there ArrowDown picks the first row and ArrowUp the last.
// Otherwise the selection wraps around the ends. Unrelated keys leave it unchanged.
function nextNavIndex(current, key, count) {
  if (count <= 0) return -1;
  if (key === 'ArrowDown') return current < 0 ? 0 : (current + 1) % count;
  if (key === 'ArrowUp')   return current < 0 ? count - 1 : (current - 1 + count) % count;
  return current;
}

// ── Export for tests (no-op in browser) ──────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = {
    encodeState, decodeState, createBlock, buildBlockEl,
    renderMarkdown, escapeHtml, toggleCheckboxLine, noteTitle,
    capacityLevel, timeAgo, mergeRecents, groupByFolder, stripFormatting,
    nextNavIndex, buildCommandList, buildHelpList, makeRecentRow,
    langIcon, langBadgeHtml, paletteEscTarget,
    themeMode, sortThemesByMode, THEMES, THEME_MODE, HLJS_THEME_URLS,
    parseTinyId, tinyExpiryLabel, TINY_EXPIRY,
  };
}
