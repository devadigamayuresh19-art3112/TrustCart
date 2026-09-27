from abc import ABC, abstractmethod


class BaseProductFetcher(ABC):

    @abstractmethod
    def fetch(self, url):
        """
        Fetch product information from a URL.

        Every product fetcher must return
        a normalized dictionary.
        """
        pass
