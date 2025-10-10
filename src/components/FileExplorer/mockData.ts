import { FileItem } from '../../types/global';

export const MOCK_ROOT = '/mock';

export const MOCK_TREE: Record<string, FileItem[]> = {
  '/mock': [
    { name: 'Projects', isDirectory: true, path: '/mock/Projects' },
    { name: 'Documents', isDirectory: true, path: '/mock/Documents' },
    { name: 'Media', isDirectory: true, path: '/mock/Media' },
    { name: 'Archives', isDirectory: true, path: '/mock/Archives' },
    {
      name: 'README.md',
      isDirectory: false,
      path: '/mock/README.md',
      size: 1536,
    },
  ],
  '/mock/Projects': [
    { name: 'Alpha', isDirectory: true, path: '/mock/Projects/Alpha' },
    { name: 'Beta', isDirectory: true, path: '/mock/Projects/Beta' },
    {
      name: 'project-notes.txt',
      isDirectory: false,
      path: '/mock/Projects/project-notes.txt',
      size: 2048,
    },
  ],
  '/mock/Projects/Alpha': [
    { name: 'src', isDirectory: true, path: '/mock/Projects/Alpha/src' },
    {
      name: 'package.json',
      isDirectory: false,
      path: '/mock/Projects/Alpha/package.json',
      size: 1024,
    },
    {
      name: 'README.md',
      isDirectory: false,
      path: '/mock/Projects/Alpha/README.md',
      size: 896,
    },
  ],
  '/mock/Projects/Alpha/src': [
    {
      name: 'index.ts',
      isDirectory: false,
      path: '/mock/Projects/Alpha/src/index.ts',
      size: 4096,
    },
    {
      name: 'utils.ts',
      isDirectory: false,
      path: '/mock/Projects/Alpha/src/utils.ts',
      size: 2048,
    },
  ],
  '/mock/Projects/Beta': [
    { name: 'app', isDirectory: true, path: '/mock/Projects/Beta/app' },
    {
      name: 'index.html',
      isDirectory: false,
      path: '/mock/Projects/Beta/index.html',
      size: 1536,
    },
  ],
  '/mock/Projects/Beta/app': [
    {
      name: 'main.js',
      isDirectory: false,
      path: '/mock/Projects/Beta/app/main.js',
      size: 3072,
    },
    {
      name: 'styles.css',
      isDirectory: false,
      path: '/mock/Projects/Beta/app/styles.css',
      size: 1024,
    },
  ],
  '/mock/Documents': [
    {
      name: 'resume.pdf',
      isDirectory: false,
      path: '/mock/Documents/resume.pdf',
      size: 345678,
    },
    {
      name: 'report.docx',
      isDirectory: false,
      path: '/mock/Documents/report.docx',
      size: 24680,
    },
    {
      name: 'notes.txt',
      isDirectory: false,
      path: '/mock/Documents/notes.txt',
      size: 1024,
    },
  ],
  '/mock/Media': [
    { name: 'Images', isDirectory: true, path: '/mock/Media/Images' },
    { name: 'Videos', isDirectory: true, path: '/mock/Media/Videos' },
    {
      name: 'music.mp3',
      isDirectory: false,
      path: '/mock/Media/music.mp3',
      size: 5120000,
    },
  ],
  '/mock/Media/Images': [
    {
      name: 'photo1.jpg',
      isDirectory: false,
      path: '/mock/Media/Images/photo1.jpg',
      size: 204800,
    },
    {
      name: 'diagram.png',
      isDirectory: false,
      path: '/mock/Media/Images/diagram.png',
      size: 102400,
    },
    {
      name: 'logo.svg',
      isDirectory: false,
      path: '/mock/Media/Images/logo.svg',
      size: 40960,
    },
  ],
  '/mock/Media/Videos': [
    {
      name: 'demo.mp4',
      isDirectory: false,
      path: '/mock/Media/Videos/demo.mp4',
      size: 104857600,
    },
  ],
  '/mock/Archives': [
    {
      name: 'backup.zip',
      isDirectory: false,
      path: '/mock/Archives/backup.zip',
      size: 2048000,
    },
    {
      name: 'dataset.tar.gz',
      isDirectory: false,
      path: '/mock/Archives/dataset.tar.gz',
      size: 73400320,
    },
  ],
};
