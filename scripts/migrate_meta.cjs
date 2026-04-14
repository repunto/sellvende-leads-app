const fs = require('fs');

try {
    let aContent = fs.readFileSync('src/pages/configuracion/tabs/AgenciaTab.jsx', 'utf8').replace(/\r\n/g, '\n');
    let iContent = fs.readFileSync('src/pages/configuracion/tabs/IntegracionesTab.jsx', 'utf8').replace(/\r\n/g, '\n');

    if (iContent.includes('const validateMetaToken = useCallback')) {
        console.log('Already migrated');
        process.exit(0);
    }

    // --- AGENCIA EXTRACTION ---
    // 1. States extraction: // Meta Token Validation State to // eslint-disable-next-line
    const statesRegex = /\/\/ Meta Token Validation State[\s\S]*?(?=\/\/ eslint-disable-next-line)/;
    const statesBlockMatch = aContent.match(statesRegex);
    const statesBlock = statesBlockMatch ? statesBlockMatch[0].trimEnd() : '';

    // 2. Fetch SDK extraction
    const sdkRegex = /\/\/ Meta SDK Initialization for App Review[\s\S]*?(?=\/\/ Auto-validate existing token on load)/;
    const sdkBlockMatch = aContent.match(sdkRegex);
    const sdkBlock = sdkBlockMatch ? sdkBlockMatch[0].trimEnd() : '';

    // 3. Auth functions extraction
    const authRegex = /\/\/ Auto-validate existing token on load[\s\S]*?(?=async function loadConfig)/;
    const authBlockMatch = aContent.match(authRegex);
    const authBlock = authBlockMatch ? authBlockMatch[0].trimEnd() : '';

    // 4. UI block extraction
    const uiStartStr = '{/* ============================================================\n                   META LEADS INTEGRATION';
    const uiEndStr = '{/* ============================================\n                   ELITE EMAIL PROVIDER SELECTOR';
    const uiStart = aContent.indexOf(uiStartStr);
    const uiEnd = aContent.indexOf(uiEndStr);

    if (uiStart === -1 || uiEnd === -1) {
        console.error('UI bound not found!', {uiStart, uiEnd});
        process.exit(1);
    }
    const uiBlock = aContent.substring(uiStart, uiEnd).trimEnd();

    console.log('States extracted:', !!statesBlock);
    console.log('SDK extracted:', !!sdkBlock);
    console.log('Auth extracted:', !!authBlock);
    console.log('UI extracted:', !!uiBlock);


    // --- INTEGRACIONES INJECTION ---
    iContent = iContent.replace(
        "import { useState, useEffect } from 'react'",
        "import { useState, useEffect, useCallback } from 'react'"
    );

    // After const [saving, setSaving] = useState(false)
    iContent = iContent.replace(
        "const [saving, setSaving] = useState(false)",
        "const [saving, setSaving] = useState(false)\n\n    " + statesBlock
    );

    // After loading config
    iContent = iContent.replace(
        "    useEffect(() => {\n" +
        "        if (agencia?.id) {\n" +
        "            fetchConfig()\n" +
        "        }\n" +
        "    }, [agencia])",
        "    useEffect(() => {\n" +
        "        if (agencia?.id) {\n" +
        "            fetchConfig()\n" +
        "        }\n" +
        "    }, [agencia])\n\n" +
        "    " + sdkBlock + "\n\n" + 
        "    " + authBlock
    );

    const checkStr = "    const isConnected = !!(config.meta_page_id && config.meta_page_access_token)\n"
    iContent = iContent.replace(
        "    return (",
        checkStr + "\n    return ("
    );

    iContent = iContent.replace(
        '<div className="card" style={{ padding: \'24px\' }}>',
        uiBlock + '\n\n            <div className="card" style={{ padding: \'24px\', marginTop: 40 }}>'
    );


    // --- AGENCIA REMOVAL ---
    let newA = aContent;
    newA = newA.replace(statesBlockMatch[0], '');
    newA = newA.replace(sdkBlockMatch[0], '');
    newA = newA.replace(authBlockMatch[0], '');
    newA = newA.replace(aContent.substring(uiStart, uiEnd), '');
    
    // Also remove the `isConnected` const from AgenciaTab if it exists independently now
    const oldIsConnectedRes = /const isConnected = config\.meta_page_id && config\.meta_page_access_token.*\n/;
    newA = newA.replace(oldIsConnectedRes, '');

    fs.writeFileSync('src/pages/configuracion/tabs/IntegracionesTab.jsx', iContent);
    fs.writeFileSync('src/pages/configuracion/tabs/AgenciaTab.jsx', newA);

    console.log('Migration completed');

} catch(e) {
    console.error(e);
}
