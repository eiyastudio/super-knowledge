import { defineConfig } from 'vite';
import { resolve } from 'path';

console.log("!!! VITE CONFIG LOADED !!!");


export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                article: resolve(__dirname, 'article.html'),
                editor: resolve(__dirname, 'editor.html'),
            },
        },
    },
    plugins: [
        {
            name: 'custom-rewrite-middleware',
            configureServer(server) {
                console.log("!!! CONFIGURE SERVER CALLED - REGISTERING MIDDLEWARE !!!");
                server.middlewares.use((req, res, next) => {
                    // Log every request to see what's happening
                    console.log(`[Middleware] Request: ${req.url}`);

                    if (req.url.indexOf('/articles/') !== -1 &&
                        !req.url.includes('/data/') &&
                        !req.url.includes('/images/') &&
                        !req.url.includes('/audio/')) {
                        console.log(`[Middleware] Rewriting ${req.url} -> /article.html`);
                        req.url = '/article.html';
                    }
                    next();
                });
            }
        }
    ],
    server: {
        // Server config
    },
    appType: 'mpa'
});
