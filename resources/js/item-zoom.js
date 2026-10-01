/**
 * FilePond plugin — adds a magnifier action button to image items.
 * Click opens a fullscreen lightbox with the original image.
 *
 * Source resolution order:
 *  - item metadata `poster` (set for already-uploaded `local` files)
 *  - object URL of the local Blob
 */

const isPreviewableImage = (file) => /^image\//.test(file?.type || '');
const IMAGE_EXT = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i;

// Lucide "zoom-in"
const ZOOM_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>';

let overlay = null;
let objectUrl = null;

const ensureOverlay = () => {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'filepond-zoom-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
        <button type="button" class="filepond-zoom-close" aria-label="Close">&times;</button>
        <img class="filepond-zoom-image" alt="" draggable="false">`;

    overlay.addEventListener('click', closeZoom);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.hidden) closeZoom();
    });

    document.body.appendChild(overlay);
};

const openZoom = (src) => {
    ensureOverlay();
    overlay.querySelector('.filepond-zoom-image').src = src;
    overlay.hidden = false;
};

const closeZoom = () => {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.querySelector('.filepond-zoom-image').removeAttribute('src');
    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
    }
};

const zoomSource = (item) => {
    const poster = item.getMetadata('poster');
    if (poster) return poster;

    const file = item.file;
    if (file instanceof Blob) {
        objectUrl = URL.createObjectURL(file);
        return objectUrl;
    }

    return null;
};

export const FilePondPluginItemZoom = (_) => {
    const { addFilter, utils, views } = _;
    const { Type, createRoute } = utils;
    const { fileActionButton } = views;

    addFilter('CREATE_VIEW', (viewAPI) => {
        const { is, view, query } = viewAPI;

        if (!query('GET_ALLOW_IMAGE_ZOOM')) return;
        if (!is('file')) return;

        const routes = {
            DID_LOAD_ITEM: ({ root, props }) => {
                const item = query('GET_ITEM', props.id);
                if (!item) return;

                const file = item.file;
                const poster = item.getMetadata('poster');

                const zoomable =
                    poster ||
                    (file instanceof Blob && isPreviewableImage(file)) ||
                    IMAGE_EXT.test(file?.name || '');

                if (!zoomable) return;

                root.ref.handleZoom = (e) => {
                    e.stopPropagation();
                    const src = zoomSource(item);
                    if (src) openZoom(src);
                };

                const buttonView = view.createChildView(fileActionButton, {
                    label: 'zoom',
                    icon: ZOOM_ICON,
                    opacity: 0,
                });

                buttonView.element.classList.add('filepond--action-zoom-item');
                buttonView.element.dataset.align = query(
                    'GET_STYLE_IMAGE_ZOOM_BUTTON_ITEM_POSITION'
                );
                buttonView.on('click', root.ref.handleZoom);

                root.ref.buttonZoomItem = view.appendChildView(buttonView);

                // limbo/local items render a poster, not an image preview —
                // there is no DID_IMAGE_PREVIEW_SHOW for them
                if (poster) root.ref.buttonZoomItem.opacity = 1;
            },

            DID_IMAGE_PREVIEW_SHOW: ({ root }) => {
                if (!root.ref.buttonZoomItem) return;
                root.ref.buttonZoomItem.opacity = 1;
            },
        };

        view.registerDestroyer(({ root }) => {
            root.ref.buttonZoomItem?.off('click', root.ref.handleZoom);
        });

        view.registerWriter(createRoute(routes));
    });

    return {
        options: {
            allowImageZoom: [true, Type.BOOLEAN],
            styleImageZoomButtonItemPosition: ['right', Type.STRING],
        },
    };
};
