import '../css/filepond.css';
import { create, registerPlugin } from 'filepond';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type';
import FilePondPluginFilePoster from 'filepond-plugin-file-poster';
import FilePondPluginImageCrop from 'filepond-plugin-image-crop';
import FilePondPluginImageEdit from 'filepond-plugin-image-edit';
import { FilePondPluginItemZoom } from './item-zoom.js';
import { createMarkerEditor, refreshThumbnail } from './marker-editor.js';

const extensionToMime = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.json': 'application/json',
    '.xml': 'application/xml',
};

function parseAcceptedFileTypes(accept) {
    if (!accept || !accept.trim()) return null;

    const types = accept.split(',')
        .map(ext => ext.trim().toLowerCase())
        .map(ext => extensionToMime[ext] || ext)
        .filter(Boolean);

    return types.length ? types : null;
}

function getFileExtension(filename) {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    return ext || '';
}

function detectFileType(source, type) {
    return new Promise((resolve, reject) => {
        const ext = getFileExtension(source.name);
        const detectedType = extensionToMime[ext];

        if (detectedType) {
            resolve(detectedType);
        } else if (type) {
            resolve(type);
        } else {
            reject();
        }
    });
}

document.addEventListener('alpine:init', () => {
    registerPlugin(
        FilePondPluginImagePreview,
        FilePondPluginFileValidateType,
        FilePondPluginFilePoster,
        FilePondPluginImageCrop,
        FilePondPluginImageEdit,
        FilePondPluginItemZoom
    );

    Alpine.data('filepond', () => ({
        files: [],
        pond: null,
        multiple: false,
        uploadedInSession: new Set(),
        processingCount: 0,
        form: null,

        get isUploading() {
            return this.processingCount > 0;
        },

        updateSubmitButton() {
            if (this.submitBtn) {
                this.submitBtn.disabled = this.isUploading;
            }
        },

        async init() {
            await this.$nextTick();

            const input = this.$refs.input;
            const dataset = input.dataset;

            const labels = dataset.labels ? JSON.parse(dataset.labels) : {};
            const acceptedFileTypes = parseAcceptedFileTypes(dataset.extensions);
            const existingFiles = dataset.files ? JSON.parse(dataset.files) : [];

            this.multiple = input.hasAttribute('multiple');

            // Initialize files array from existing files
            this.files = existingFiles.map(f => f.source);

            const serverUrl = dataset.server || '/upload';

            // submitted values per item (item.id → paths)
            // local items keep their original source AND gain the edited upload
            const itemValues = new Map();

            // Image editor (marker.js 3 via filepond-plugin-image-edit)
            const imageEditor = dataset.imageEdit === 'true'
                ? createMarkerEditor({
                      labels,
                      instant: dataset.imageEditInstant === 'true',
                  })
                : null;

            // local items carry no Blob — resolve the poster URL for the editor
            if (imageEditor) {
                const rawOpen = imageEditor.open.bind(imageEditor);
                imageEditor.open = (file, params) => {
                    const item = this.pond?.getFiles().find((i) => i.file === file);
                    rawOpen(file, params, item?.getMetadata('poster') || null, item);
                };

                // editing an already-uploaded file appends the edited render
                // as a NEW item — the original stays in the list untouched
                imageEditor.onEditedCopy = (blob, item) => {
                    const ext = blob.type.split('/')[1] || 'png';
                    const base = (item?.filename || item?.file?.name || 'image')
                        .replace(/\.[^.]+$/, '');
                    this.pond?.addFile(
                        new File([blob], `${base}.${ext}`, { type: blob.type })
                    );
                };
            }

            const options = {
                ...dataset,
                ...labels,
                ...(acceptedFileTypes && {
                    acceptedFileTypes,
                    fileValidateTypeDetectType: detectFileType,
                }),
                ...(existingFiles.length && { files: existingFiles }),
                allowMultiple: this.multiple,
                allowReorder: this.multiple && dataset.allowReorder === 'true',
                // Preview sizes
                imagePreviewHeight: dataset.previewHeight ? parseInt(dataset.previewHeight) : 100,
                imagePreviewMinHeight: dataset.previewMinHeight ? parseInt(dataset.previewMinHeight) : 44,
                imagePreviewMaxHeight: dataset.previewMaxHeight ? parseInt(dataset.previewMaxHeight) : 100,
                filePosterHeight: dataset.posterHeight ? parseInt(dataset.posterHeight) : 100,
                // Panel layout (aspectRatio only for single file mode)
                ...(!this.multiple && dataset.panelAspectRatio && { stylePanelAspectRatio: dataset.panelAspectRatio }),
                ...(dataset.compact === 'true' && { stylePanelLayout: 'compact' }),
                // Avatar mode: circular single-file uploader (buttons along the bottom edge)
                ...(dataset.avatar === 'true' && !this.multiple && {
                    stylePanelLayout: 'compact circle',
                    styleButtonRemoveItemPosition: 'bottom center',
                    styleButtonProcessItemPosition: 'right bottom',
                    styleProgressIndicatorPosition: 'right bottom',
                    styleLoadIndicatorPosition: 'center bottom',
                    styleImageZoomButtonItemPosition: 'bottom center',
                    imageCropAspectRatio: '1:1',
                }),
                // Zoom/lightbox button on image items (default on, disable with data-zoom="false")
                allowImageZoom: dataset.zoom !== 'false',
                ...(imageEditor && {
                    allowImageEdit: true,
                    imageEditAllowEdit: true,
                    imageEditInstantEdit: dataset.imageEditInstant === 'true',
                    imageEditEditor: imageEditor,
                }),
                server: {
                    // FilePond calls revert before re-uploading an edited item —
                    // no server-side delete; orphan cleanup happens on form apply
                    revert: (uniqueFileId, load) => {
                        load();
                    },
                    // removing a stored (local) item also hits the server by default
                    // (DELETE on the form URL → 405) — paths are reconciled on submit
                    remove: (source, load) => {
                        load();
                    },
                    process: (fieldName, file, metadata, load, error, progress, abort) => {
                        // upload the annotated image instead of the original
                        const uploadFile = imageEditor?.getEditedFile(file) || file;

                        const data = new FormData();
                        data.append(fieldName, uploadFile, uploadFile.name || file.name);

                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', serverUrl);
                        xhr.setRequestHeader(
                            'X-CSRF-TOKEN',
                            document.querySelector('meta[name="csrf-token"]')?.content || ''
                        );

                        xhr.upload.onprogress = (e) => {
                            progress(e.lengthComputable, e.loaded, e.total);
                        };

                        xhr.onload = () => {
                            if (xhr.status >= 200 && xhr.status < 300) {
                                try {
                                    const response = JSON.parse(xhr.responseText);
                                    load(response.path);
                                } catch {
                                    error('Invalid server response');
                                }
                            } else {
                                error(xhr.responseText || 'Upload failed');
                            }
                        };

                        xhr.onerror = () => error('Upload failed');
                        xhr.send(data);

                        return {
                            abort: () => {
                                xhr.abort();
                                abort();
                            },
                        };
                    },
                },
                credits: false,
            };

            this.pond = create(input, options);

            // Constrain avatar to a square-ish width
            if (dataset.avatar === 'true' && !this.multiple) {
                this.pond.element.classList.add('filepond--avatar');
            }

            // Apply grid layout for multiple files
            if (this.multiple && dataset.grid === 'true') {
                this.pond.element.classList.add('filepond--grid');
                if (dataset.columns) {
                    this.pond.element.style.setProperty('--filepond-grid-cols', dataset.columns);
                }
            }

            // Find parent form and block submit during upload
            this.form = this.$el.closest('form');
            this.submitBtn = this.form?.querySelector('[type="submit"]');

            if (this.form) {
                this.form.addEventListener('submit', (e) => {
                    if (this.isUploading) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });
            }

            // Track upload start
            this.pond.on('processfilestart', () => {
                this.processingCount++;
                this.updateSubmitButton();
            });

            // Rebuild hidden inputs from pond items in current order.
            // Items still processing yield their File object as source —
            // only submitted string values (paths / serverIds) are allowed.
            const syncFiles = () => {
                this.files = this.pond
                    .getFiles()
                    .flatMap((item) => itemValues.get(item.id) ?? [item.serverId || item.source])
                    .filter((v) => typeof v === 'string' && v !== '');
            };

            // Track upload end (success or error)
            this.pond.on('processfile', (error, file) => {
                this.processingCount = Math.max(0, this.processingCount - 1);
                this.updateSubmitButton();

                if (!error && file.serverId) {
                    this.uploadedInSession.add(file.serverId);

                    // an edit re-uploads the item:
                    // - local item (string source) → keep the original path AND
                    //   append the new upload (original is preserved)
                    // - fresh upload → keep only the latest serverId (replaces
                    //   the pre-edit upload, no duplicate)
                    const keep = typeof file.source === 'string' ? [file.source] : [];
                    itemValues.set(file.id, [...keep, file.serverId]);

                    // the re-upload may trigger a preview redraw from the
                    // original file — restore the edited thumbnail
                    const editedPreview = file.getMetadata?.('editedPreview');
                    if (editedPreview) refreshThumbnail(file, editedPreview);

                    syncFiles();
                }
            });

            // Track upload abort
            this.pond.on('processfileabort', () => {
                this.processingCount = Math.max(0, this.processingCount - 1);
                this.updateSubmitButton();
            });

            this.pond.on('removefile', (error, file) => {
                if (error) return;

                const values = itemValues.get(file.id) ?? [file.serverId || file.source];
                values.forEach((v) => this.uploadedInSession.delete(v));
                itemValues.delete(file.id);
                syncFiles();
            });

            // Sync hidden inputs order when files are reordered
            this.pond.on('reorderfiles', () => {
                syncFiles();
            });
        },
    }));
})
