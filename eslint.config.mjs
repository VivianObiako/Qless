import next from "eslint-config-next";

const eslintConfig = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "e2e/**"] },
];

export default eslintConfig;
