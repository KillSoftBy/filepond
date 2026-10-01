<p align="center">
<a href="https://packagist.org/packages/moonshine/filepond"><img src="https://img.shields.io/packagist/dt/moonshine/filepond" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/moonshine/filepond"><img src="https://img.shields.io/packagist/v/moonshine/filepond" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/moonshine/filepond"><img src="https://img.shields.io/packagist/l/moonshine/filepond" alt="License"></a>
</p>
<p align="center">
    <a href="https://laravel.com"><img alt="Laravel 10+" src="https://img.shields.io/badge/Laravel-10+-FF2D20?style=for-the-badge&logo=laravel"></a>
    <a href="https://laravel.com"><img alt="PHP 8.2+" src="https://img.shields.io/badge/PHP-8.2+-777BB4?style=for-the-badge&logo=php"></a>
</p>

# MoonShine FilePond

A modern file upload field for [MoonShine](https://github.com/moonshine-software/moonshine) admin panel, powered by the [FilePond](https://pqina.nl/filepond/) JavaScript library.

## Features

- Drag and drop file uploads
- Image previews with customizable dimensions
- Multiple file uploads with grid layout
- File reordering via drag and drop
- Fullscreen image preview lightbox (zoom button on every image item)
- Configurable grid columns for multiple uploads
- File type validation
- Built-in image annotation editor (draw, highlight, arrows — powered by [marker.js 3](https://markerjs.com))
- Localization support (EN, RU)
- Seamless integration with MoonShine v4+

## Requirements

- PHP 8.2+
- Laravel 10+
- MoonShine 4.0+

## Installation

Install the package via Composer:

```bash
composer require moonshine/filepond
```

Publish assets:

```bash
php artisan vendor:publish --tag=moonshine-filepond-assets
```

Optionally, publish translations:

```bash
php artisan vendor:publish --tag=moonshine-filepond-lang
```

## Usage

### Basic Usage

```php
use MoonShine\Filepond\Fields\Filepond;

Filepond::make('Avatar', 'avatar')
    ->disk('public')
    ->dir('avatars');
```

### Multiple Files

```php
Filepond::make('Gallery', 'images')
    ->disk('public')
    ->dir('gallery')
    ->multiple();
```

> **Note:** When using `multiple()`, ensure your model has the appropriate cast for the attribute:
>
> ```php
> protected function casts(): array
> {
>     return [
>         'images' => 'array', // or 'collection', 'json'
>     ];
> }
> ```

### With File Type Restrictions

```php
Filepond::make('Documents', 'files')
    ->disk('public')
    ->dir('documents')
    ->multiple()
    ->acceptExtensions('pdf', 'doc', 'docx');
```

## Configuration Methods

### Item Dimensions

Set the preview item height with optional min/max values:

```php
Filepond::make('Image')
    ->itemHeight(150)           // height: 150px
    ->itemHeight(150, 50, 200); // height: 150px, min: 50px, max: 200px
```

### Grid Layout

Grid layout is enabled by default for multiple uploads: items render 2 per row on medium screens and 3 per row on wide screens.

Change the number of columns on wide screens:

```php
Filepond::make('Gallery', 'images')
    ->multiple()
    ->gridColumns(4);
```

To disable grid layout and stack items vertically:

```php
Filepond::make('Files')
    ->multiple()
    ->vertical();
```

### Avatar Mode

Circular compact uploader for profile photos (single file only — ignored in `multiple()` mode). The panel becomes a circle, action buttons sit along its bottom edge:

```php
Filepond::make('Avatar', 'avatar')
    ->acceptExtensions('jpg', 'jpeg', 'png', 'webp')
    ->avatar();
```

Combines well with `imageEdit()` — the annotation editor opens in a modal and crop defaults to 1:1.

### Image Preview Lightbox

Every image item gets a magnifier button that opens the image fullscreen in a lightbox (click or `Esc` to close). Works both for new uploads and already-uploaded files. Enabled by default — to disable:

```php
Filepond::make('Gallery', 'images')
    ->multiple()
    ->zoomable(false);
```

### Aspect Ratio

Set the panel aspect ratio for the upload area:

```php
Filepond::make('Cover')
    ->aspectRatio('16:9'); // or '1:1', '4:3', etc.
```

### Compact Mode

Enable compact layout where the preview replaces the drop area:

```php
Filepond::make('Thumbnail')
    ->compact();
```

### Image Annotation Editor

Enable the built-in [marker.js 3](https://markerjs.com) editor so users can annotate images (draw, highlight areas, arrows, text, blur) before upload:

```php
Filepond::make('Screenshot', 'screenshot')
    ->disk('public')
    ->dir('screenshots')
    ->acceptExtensions('jpg', 'jpeg', 'png', 'webp')
    ->imageEdit();
```

An "edit" button appears on every image preview item. The annotated image is rendered and uploaded instead of the original.

To open the editor automatically as soon as an image is added (before it uploads), pass `true`:

```php
Filepond::make('Screenshot', 'screenshot')
    ->imageEdit(instant: true);
```

> **Note:** marker.js 3 is released under the *linkware* license — it is free to use, but a small logo is shown in the editor corner. Commercial licenses to remove it are available at [markerjs.com](https://markerjs.com).

## Complete Example

```php
use MoonShine\Filepond\Fields\Filepond;

public function fields(): array
{
    return [
        // Single file with aspect ratio and compact mode
        Filepond::make('Thumbnail', 'thumbnail')
            ->disk('public')
            ->dir('thumbnails')
            ->acceptExtensions('jpg', 'jpeg', 'png', 'webp')
            ->aspectRatio('16:9')
            ->compact(),

        // Multiple files in a grid layout
        Filepond::make('Gallery', 'images')
            ->disk('public')
            ->dir('gallery')
            ->multiple()
            ->itemHeight(180, 100, 200)
            ->acceptExtensions('jpg', 'jpeg', 'png', 'gif', 'webp'),

        // Documents with vertical layout
        Filepond::make('Documents', 'documents')
            ->disk('public')
            ->dir('documents')
            ->multiple()
            ->vertical()
            ->acceptExtensions('pdf', 'doc', 'docx', 'xls', 'xlsx'),
    ];
}
```

## Localization

The package includes translations for English and Russian. To customize translations, publish the language files:

```bash
php artisan vendor:publish --tag=moonshine-filepond-lang
```

Translation files will be published to `lang/vendor/moonshine-filepond/`.

## License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.
