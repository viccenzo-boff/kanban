import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // O eslint-plugin-react-hooks 7 (trazido pelo eslint-config-next 16) passou
    // a reprovar padroes que ja existiam na base antes do upgrade. Corrigi-los
    // exige refatorar estado derivado e ciclo de vida de componentes sem
    // nenhuma cobertura de regressao visual, entao ficam como aviso ate serem
    // tratados em mudanca propria. Ver ROADMAP.md, P6.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react/display-name": "warn",
    },
  },
];

export default eslintConfig;
