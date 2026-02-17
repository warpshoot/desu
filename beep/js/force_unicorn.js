(function () {
    console.log("🦄 Unicorn Theme Enforcer Loaded");

    const rules = {
        'body': {
            fontFamily: "'Kiwi Maru', 'Varela Round', sans-serif"
        },
        '#sequencer-inner': {
            background: 'rgba(255, 255, 255, 0.4)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
            backdropFilter: 'blur(4px)',
            borderRadius: '20px',
            border: '3px solid rgba(255, 255, 255, 0.6)',
            padding: '10px'
        },
        '#pattern-bank': {
            display: 'flex',
            background: '#fff',
            border: '2px solid #b39ddb',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '8px',
            height: '34px',
            width: '100%'
        },
        '.pattern-pad': {
            flex: '1',
            background: '#fff',
            borderRight: '1px solid #b39ddb',
            color: '#b39ddb',
            fontWeight: 'bold',
            height: '100%',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },
        '#scale-select': {
            background: '#ffffff',
            backgroundColor: '#ffffff',
            border: '2px solid #b39ddb',
            borderRadius: '20px',
            color: '#5e35b1'
        },
        '#chain-mode-switch': {
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            padding: '0',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            height: '40px',
            width: '40px'
        },
        '.mode-option': {
            height: '18px',
            width: '100%',
            padding: '0',
            fontSize: '8px',
            borderRadius: '99px',
            fontWeight: 'bold',
            color: '#5e35b1',
            background: '#fff',
            border: '2px solid #b39ddb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },
        '.cell': {
            background: 'rgba(255, 255, 255, 0.6)',
            border: '2px solid #e1bee7',
            borderRadius: '12px'
        }
    };

    function applyStyles() {
        for (const selector in rules) {
            const elements = document.querySelectorAll(selector);
            const style = rules[selector];
            elements.forEach(el => {
                for (const prop in style) {
                    el.style[prop] = style[prop];
                }
            });
        }
    }

    // Apply immediately and on periodic intervals to fight overrides
    applyStyles();
    setInterval(applyStyles, 1000);
    window.addEventListener('load', applyStyles);
})();
