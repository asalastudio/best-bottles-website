/**
 * The measured 9 mL / 17-415 component layers from the Phase 3 pilot.
 * Production register rows also contain later full-bottle crops copied from
 * several glass colors. Those crops are not interchangeable component parts:
 * they paint amber, cobalt or Swirl glass over the selected body plate.
 *
 * Source: data/register/phase3/pilot-measurements.json. The extra metal
 * roller hash is its reviewed seated insert with a silver ball; the older
 * pilot crop alone has a black ball and needs that short correction layer.
 */
export const CYLINDER9_PILOT_LAYER_HASHES: Readonly<Record<string, readonly string[]>> = {
    "CMP-LPM-BLK-17-415": [
        "60eefa3c2a0fc252aca1a5cbcacb103f7b8fbe9b1f5d0f160d354b271a1113f6",
        "53eb2a798e06db33e08e9e04e5636b193a2c2f5a71e34e01bb950c59f81fcbb9",
        "dff02db6b0e742574fb4ac8bf36e545ce9d3dc34d5933ad7183b652433061b79",
        "4abbfc08c1b0fca7520bd77806081db0ab393930792ba07ad4e648801e290243"
    ],
    "CMP-LPM-MSLV-17-415": [
        "60eefa3c2a0fc252aca1a5cbcacb103f7b8fbe9b1f5d0f160d354b271a1113f6",
        "53eb2a798e06db33e08e9e04e5636b193a2c2f5a71e34e01bb950c59f81fcbb9",
        "bce8b6712e4e5518b9b7b810afbd3c2d44999c6e7732dea1c933885de45c2aec",
        "4abbfc08c1b0fca7520bd77806081db0ab393930792ba07ad4e648801e290243"
    ],
    "CMP-LPM-SGLD-17-415": [
        "60eefa3c2a0fc252aca1a5cbcacb103f7b8fbe9b1f5d0f160d354b271a1113f6",
        "53eb2a798e06db33e08e9e04e5636b193a2c2f5a71e34e01bb950c59f81fcbb9",
        "a2caa8655dc2429857e029d875eeca3661bf33a0a891c60961627967cbf8deab",
        "344e210c2691a8c9fda008058f5ef5a695b533f5f9b81dabba55e0f87e8474e0"
    ],
    "CMP-ROC-BLK-17415-DOT": [
        "560f58877ddc937518530400d3d0132b1391758a93a2ae1b5c0378b495968f79"
    ],
    "CMP-ROC-CPR-17415": [
        "4f85393e5afe485396eea97c7ae15e3132288f8955720cf60861e13a384da0f6"
    ],
    "CMP-ROC-MGLD-17415": [
        "9c2c33f11f70cc55d7ab5d6db1fc2d669ee2676e0aac2683479b66ebbafd0b46"
    ],
    "CMP-ROC-MSLV-17415": [
        "269a6debdadd773ab5df125b4cedf15a95c0b9d521b7d385738129cf92b74e3b"
    ],
    "CMP-ROC-PNK-17415-DOT": [
        "5a2614195ffbb2c35e354accc41398d008f77db32b5d76b942fff30e580a402f"
    ],
    "CMP-ROC-SBLK-17415": [
        "79d2087220930c5eec46e9256c8ac92e7c411db1269cb9ad9ff17124023a7b56"
    ],
    "CMP-ROC-SGLD-17415": [
        "db7a782eb465e7210253866a8ea7e9af309be7190e048c86f6e84117d0fc0d5a"
    ],
    "CMP-ROC-SLV-17415-DOT": [
        "364eb02f2c4395119b41fa1447554493d5d4c6de93d30fff1e9a2457dec5d355"
    ],
    "CMP-ROC-SSLV-17415": [
        "ea865493eb54f33e76b0ef19377930a6b6e426aef723f1da802a11e0c8fa3c1c"
    ],
    "CMP-ROC-WHT-17415": [
        "c6ddedc13a4175ac2e0832ce843a17e5ee4ed993d09e933d4c9dba48fcbfa262"
    ],
    "CMP-SPR-BLK-17-415-01": [
        "60eefa3c2a0fc252aca1a5cbcacb103f7b8fbe9b1f5d0f160d354b271a1113f6",
        "dff02db6b0e742574fb4ac8bf36e545ce9d3dc34d5933ad7183b652433061b79",
        "01b4b723b9b48da17ac68c109d2c0228c78c38cb165ca8b32a47dbaa6a873387"
    ],
    "CMP-SPR-CLR-17-415": [
        "60eefa3c2a0fc252aca1a5cbcacb103f7b8fbe9b1f5d0f160d354b271a1113f6",
        "c3d7bd5f5e539c5caf8726381cd8bd533973dd26321086cb64d426f236fa38d4",
        "9cc66ed00d6246cddbac7211492bd2722d6d3c4331fff32f0764963d7edfce82"
    ],
    "CMP-SPR-RED-17-415": [
        "60eefa3c2a0fc252aca1a5cbcacb103f7b8fbe9b1f5d0f160d354b271a1113f6",
        "72adc567286a99a486ef379857035353ca27058aa369bb048e0e4e7bad0b2779",
        "9cc66ed00d6246cddbac7211492bd2722d6d3c4331fff32f0764963d7edfce82"
    ],
    "CMP-SPR-SGLD-17-415": [
        "60eefa3c2a0fc252aca1a5cbcacb103f7b8fbe9b1f5d0f160d354b271a1113f6",
        "a2caa8655dc2429857e029d875eeca3661bf33a0a891c60961627967cbf8deab",
        "01b4b723b9b48da17ac68c109d2c0228c78c38cb165ca8b32a47dbaa6a873387"
    ],
    "CMP-SPR-SLV-17-415": [
        "60eefa3c2a0fc252aca1a5cbcacb103f7b8fbe9b1f5d0f160d354b271a1113f6",
        "bce8b6712e4e5518b9b7b810afbd3c2d44999c6e7732dea1c933885de45c2aec",
        "e922a04a68884d4ba3f75db93ff678bc79364c613bf8d9071fe5434024910155"
    ],
    "CMP-SPR-SSLV-17-415": [
        "60eefa3c2a0fc252aca1a5cbcacb103f7b8fbe9b1f5d0f160d354b271a1113f6",
        "85fceab7cafd1a47d516a9153e0f682a4b6b6f4d108111ac439552bedb0f2f9c",
        "01b4b723b9b48da17ac68c109d2c0228c78c38cb165ca8b32a47dbaa6a873387"
    ],
    "LIB-17-415-MtlRollon": [
        "d64975a48a1c447a1ab6f2a68a1c5252cf5a56e6d07c41d3ab6b3c17e3f94bba",
        "4c3c4a5090ce2c419265e57716991288dc02fc0d0d0a0b2d7c2a91dff5921c48"
    ],
    "LIB-17-415-PlsticRollon": [
        "57a014b1b52e36dff0328511cb7512333eaca2ab5c2067d0fcfefe106cc2758f"
    ]
};
