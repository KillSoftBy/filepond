import { Renderer } from '@markerjs/markerjs3';
import { AnnotationEditor } from '@markerjs/markerjs-ui';

if (!customElements.get('markerjs-ui-annotation-editor')) {
    try {
        customElements.define('markerjs-ui-annotation-editor', AnnotationEditor);
    } catch {
        // already registered by the package itself under this or another tag
    }
}

const dataUrlToBlob = (dataUrl) =>
    fetch(dataUrl).then((res) => res.blob());

// FilePond draws the thumbnail from the unmodified item.file — swap the
// rendered img src so the edit is visible without a page reload.
// Two passes: FilePond's queued view writes (and the preview redraw after
// the re-upload completes) would otherwise restore the old image.
export const refreshThumbnail = (item, dataUrl) => {
    if (!item) return;
    const swap = () => {
        const el = document.getElementById(`filepond--item-${item.id}`);
        el?.querySelectorAll('img').forEach((img) => {
            if (img.src !== dataUrl) img.src = dataUrl;
        });
    };
    requestAnimationFrame(swap);
    setTimeout(swap, 150);
};

/**
 * FilePond `imageEditEditor` adapter backed by marker.js 3 UI.
 *
 * Contract consumed by filepond-plugin-image-edit:
 *  - open(file, imageParameters) is called to show the editor
 *  - this.onconfirm({ data }) must be fired when the user confirms
 *  - this.oncancel() when the user aborts
 *  - this.onclose() (set by the plugin) after the editor UI is closed
 *
 * The rendered image is stored in a WeakMap keyed by the original File so
 * `server.process` can upload the annotated result instead of the original.
 */
export function createMarkerEditor({ labels = {}, instant = false } = {}) {
    const editedFiles = new WeakMap();

    let overlay = null;
    let editor = null;
    let currentFile = null;
    let currentItem = null;
    let targetImg = null;
    let objectUrl = null;

    const ensureDom = () => {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.className = 'filepond-editor-overlay';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="filepond-editor" role="dialog" aria-modal="true">
                <div class="filepond-editor-header">
                    <button type="button" class="filepond-editor-cancel" data-cancel>
                        ${labels.cancel || 'Cancel'}
                    </button>
                </div>
                <div class="filepond-editor-body"></div>
            </div>`;

        overlay.querySelector('[data-cancel]').addEventListener('click', () => {
            api.oncancel?.();
            api.close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !overlay.hidden) {
                api.oncancel?.();
                api.close();
            }
        });

        document.body.appendChild(overlay);
    };

    const renderState = (state) => {
        const renderer = new Renderer();
        renderer.naturalSize = true;
        renderer.targetImage = targetImg;
        return renderer.rasterize(state);
    };

    const api = {
        open(file, imageParameters, sourceUrl = null, item = null) {
            ensureDom();
            currentFile = file;
            currentItem = item;

            // `local` items have no Blob payload — edit the poster URL instead
            let src = sourceUrl;
            if (!src) {
                objectUrl = URL.createObjectURL(file);
                src = objectUrl;
            }
            targetImg = new Image();
            targetImg.onload = () => {
                editor = new AnnotationEditor();
                editor.targetImage = targetImg;

                editor.addEventListener('editorsave', (e) => {
                    api.save(e.detail);
                });
                editor.addEventListener('editorclose', () => {
                    api.oncancel?.();
                    api.close();
                });

                overlay.querySelector('.filepond-editor-body').appendChild(editor);
                overlay.hidden = false;

                // restore previous annotation state when re-editing
                if (imageParameters?.markup && typeof editor.restoreState === 'function') {
                    try {
                        editor.restoreState(imageParameters.markup);
                    } catch {
                        // state from an incompatible version, start fresh
                    }
                }
            };
            targetImg.onerror = () => {
                api.oncancel?.();
                api.close();
            };
            targetImg.src = src;
        },

        async save(detail) {
            try {
                const state = detail?.state ?? editor.getState();
                const hasMarkers = state?.markers?.length > 0;

                if (hasMarkers) {
                    const dataUrl = await renderState(state);
                    const blob = await dataUrlToBlob(dataUrl);

                    const isLocalItem = typeof currentItem?.source === 'string';

                    if (isLocalItem) {
                        // already-uploaded file: keep it untouched and append
                        // the edited render as a NEW pond item alongside it.
                        // oncancel — NOT onconfirm — so the plugin never
                        // setMetadata() on this item (that would re-upload
                        // the stub file, which has no real data)
                        api.onEditedCopy?.(blob, currentItem);
                        api.oncancel?.();
                    } else {
                        editedFiles.set(currentFile, blob);

                        // silent metadata — display-only, must NOT trigger re-upload
                        currentItem?.setMetadata('editedPreview', dataUrl, true);
                        refreshThumbnail(currentItem, dataUrl);

                        // markup metadata lets the plugin pass state back on re-edit
                        api.onconfirm?.({ data: { markup: state } });
                    }
                } else if (instant) {
                    // editor opened automatically on add — keep the file, skip re-upload
                    api.onconfirm?.({ data: {} });
                } else {
                    // nothing drawn → behave like cancel so the plugin doesn't
                    // setMetadata and trigger a re-upload of a stub file
                    api.oncancel?.();
                }
            } catch {
                api.oncancel?.();
            } finally {
                api.close();
            }
        },

        close() {
            if (editor) {
                editor.remove();
                editor = null;
            }
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
                objectUrl = null;
            }
            currentFile = null;
            if (overlay) overlay.hidden = true;
            api.onclose?.();
        },

        /** Returns the annotated Blob for a previously edited File, if any. */
        getEditedFile(file) {
            return editedFiles.get(file) || null;
        },

        // hooks assigned by filepond-plugin-image-edit
        onconfirm: null,
        oncancel: null,
        onclose: null,
    };

    return api;
}
