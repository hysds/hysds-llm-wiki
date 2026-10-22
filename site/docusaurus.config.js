// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'HySDS Wiki',
  tagline: 'Architecture decisions, service catalog, and risk register',
  favicon: 'img/favicon.ico',

  url: 'https://hysds.github.io',
  baseUrl: '/hysds-llm-wiki/',
  organizationName: 'hysds',
  projectName: 'hysds-llm-wiki',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          // Source the wiki markdown one level up, leaving content files
          // untouched in their canonical locations.
          path: '..',
          routeBasePath: '/',
          include: ['**/*.md', '**/*.mdx', '.claude/**/*.md'],
          exclude: [
            'site/**',
            '**/node_modules/**',
            '.claude/agent-memory/**',
          ],
          sidebarPath: './sidebars.js',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'HySDS Wiki',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'wikiSidebar',
            position: 'left',
            label: 'Docs',
          },
        ],
      },
      footer: {
        style: 'dark',
        copyright: `HySDS Wiki — JPL / NASA`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
