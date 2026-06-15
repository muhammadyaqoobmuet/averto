// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Replays extends APIResource {
    /**
     * Returns page metadata for a session replay, including timing information and the
     * URL of each page's HLS playlist.
     */
    retrieve(id, options) {
        return this._client.get(`/v1/sessions/${id}/replays`, options);
    }
    /**
     * Returns an HLS VOD media playlist (.m3u8) for a specific page of a session
     * replay.
     */
    retrievePage(id, pageId, options) {
        return this._client.get(`/v1/sessions/${id}/replays/${pageId}`, {
            ...options,
            headers: { Accept: 'application/vnd.apple.mpegurl', ...options?.headers },
            __binaryResponse: true,
        });
    }
}
//# sourceMappingURL=replays.mjs.map