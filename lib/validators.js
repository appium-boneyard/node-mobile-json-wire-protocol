const validators = {
  setUrl: (url) => {
    if (!url || !url.match(/^https?:\/\//)) {
      throw new Error("Url must start with http");
    }
  }
};

export { validators };
