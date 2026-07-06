export default class BaseSource {
    constructor(config) {
        this.name = config.name;
        this.domain = config.domain;
        this.pidMult = config.pidMult || 42;
    }

    // Métodos que cada fuente DEBE implementar
    async getPostCounts(tagName) { throw new Error("Not implemented"); }
    async fetchPosts(page, tagName, browser) { throw new Error("Not implemented"); }
    async resolveImageUrl(postUrl, browser) { throw new Error("Not implemented"); }
}
