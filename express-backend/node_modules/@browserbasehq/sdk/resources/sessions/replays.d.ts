import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { type Response } from "../../_shims/index.js";
export declare class Replays extends APIResource {
    /**
     * Returns page metadata for a session replay, including timing information and the
     * URL of each page's HLS playlist.
     */
    retrieve(id: string, options?: Core.RequestOptions): Core.APIPromise<ReplayRetrieveResponse>;
    /**
     * Returns an HLS VOD media playlist (.m3u8) for a specific page of a session
     * replay.
     */
    retrievePage(id: string, pageId: string, options?: Core.RequestOptions): Core.APIPromise<Response>;
}
export interface ReplayRetrieveResponse {
    pageCount: number;
    pages: Array<ReplayRetrieveResponse.Page>;
}
export declare namespace ReplayRetrieveResponse {
    interface Page {
        endTimeMs: number;
        pageId: string;
        startTimeMs: number;
        url: string;
    }
}
export declare namespace Replays {
    export { type ReplayRetrieveResponse as ReplayRetrieveResponse };
}
//# sourceMappingURL=replays.d.ts.map