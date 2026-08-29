/** 404 */
import { el } from '../core/dom.js';
import { icon } from '../core/icons.js';

export default {
  title: 'Not found',
  async view({ path }) {
    return el(`
      <div class="page">
        <div class="empty" style="padding-block:var(--s-10)">
          <div class="empty-art">${icon('compass', { size: 30 })}</div>
          <h3>That page has moved on</h3>
          <p><span class="mono">#/${path}</span> is not one of the CRM’s screens.</p>
          <div class="row" style="gap:var(--s-2);margin-top:var(--s-2)">
            <a class="btn btn-primary sm" href="#/">Back to dashboard</a>
            <a class="btn btn-secondary sm" href="#/list">Open the lead list</a>
          </div>
        </div>
      </div>`);
  },
};
