import '@testing-library/jest-dom';

// JSDOM doesn't implement scroll APIs — stub them out globally
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.scrollTo = () => {};
