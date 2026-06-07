import { galleryAlbums } from "../data/galleryAlbums.js";

export const ownerCustomGalleryAlbumValue = "__custom__";

export const ownerGalleryAlbumOptions = [
  ...galleryAlbums.map((album) => ({
    value: album.id,
    label: album.title,
  })),
  {
    value: ownerCustomGalleryAlbumValue,
    label: "自定义",
  },
];

export function resolveOwnerGalleryAlbum(selectedAlbum, customAlbum = "") {
  if (selectedAlbum === ownerCustomGalleryAlbumValue) {
    return customAlbum.trim();
  }
  return selectedAlbum.trim();
}
