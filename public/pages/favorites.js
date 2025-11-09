// pages/favorites.js
import { h } from '/core/helpers.js';
import { renderLayout, lazyThumbs } from '/core/ui.js';
import { videoUrl } from '/core/api.js';
import { loadFavs, state } from '/core/stores.js';
import { cardVideo } from '/core/components.js';

export async function renderFavorites() {
  await loadFavs();
  const favList = state.favorites;
  if (!favList.length) {
    return renderLayout(h('div', { class: 'notice' }, 'No favorites yet.'));
  }
  const grid = h('div', { class: 'grid' }, favList.map(item => cardVideo(item)));
  renderLayout(grid);
  lazyThumbs();
}
