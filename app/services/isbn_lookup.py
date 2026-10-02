import httpx
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

async def fetch_isbn_metadata(isbn: str) -> Optional[Dict[str, Any]]:
    """
    Fetches bibliographic metadata for an ISBN-10 or ISBN-13 from Open Library
    and Google Books APIs.
    """
    clean_isbn = isbn.replace("-", "").replace(" ", "").strip()
    if not clean_isbn:
        return None

    # Try Open Library first
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            ol_url = f"https://openlibrary.org/api/books?bibkeys=ISBN:{clean_isbn}&format=json&jscmd=data"
            resp = await client.get(ol_url)
            if resp.status_code == 200:
                data = resp.json()
                key = f"ISBN:{clean_isbn}"
                if key in data:
                    item = data[key]
                    authors = [a.get("name", "") for a in item.get("authors", []) if "name" in a]
                    publishers = [p.get("name", "") for p in item.get("publishers", []) if "name" in p]
                    
                    cover_url = None
                    if "cover" in item:
                        cover_url = item["cover"].get("large") or item["cover"].get("medium") or item["cover"].get("small")

                    # Dewey classification if available
                    classifications = item.get("classifications", {})
                    dewey = ""
                    if "dewey_decimal_class" in classifications and classifications["dewey_decimal_class"]:
                        dewey = classifications["dewey_decimal_class"][0]

                    pub_year = None
                    pub_date = item.get("publish_date", "")
                    for token in pub_date.split():
                        if token.isdigit() and len(token) == 4:
                            pub_year = int(token)
                            break

                    return {
                        "isbn_13": clean_isbn if len(clean_isbn) == 13 else "",
                        "isbn_10": clean_isbn if len(clean_isbn) == 10 else "",
                        "title": item.get("title", ""),
                        "subtitle": item.get("subtitle", ""),
                        "authors": authors if authors else ["Unknown Author"],
                        "publisher": publishers[0] if publishers else "Unknown Publisher",
                        "publication_year": pub_year,
                        "classification_code": dewey or "000",
                        "summary": item.get("notes", "") or item.get("description", ""),
                        "cover_image_url": cover_url,
                        "source": "Open Library"
                    }
    except Exception as e:
        logger.warning(f"Open Library lookup failed for ISBN {clean_isbn}: {e}")

    # Fallback to Google Books API
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            gb_url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{clean_isbn}"
            resp = await client.get(gb_url)
            if resp.status_code == 200:
                data = resp.json()
                if "items" in data and len(data["items"]) > 0:
                    info = data["items"][0].get("volumeInfo", {})
                    pub_date = info.get("publishedDate", "")
                    pub_year = None
                    if pub_date and len(pub_date) >= 4 and pub_date[:4].isdigit():
                        pub_year = int(pub_date[:4])

                    cover_url = None
                    if "imageLinks" in info:
                        cover_url = info["imageLinks"].get("thumbnail") or info["imageLinks"].get("smallThumbnail")
                        if cover_url and cover_url.startswith("http://"):
                            cover_url = "https://" + cover_url[7:]

                    return {
                        "isbn_13": clean_isbn if len(clean_isbn) == 13 else "",
                        "isbn_10": clean_isbn if len(clean_isbn) == 10 else "",
                        "title": info.get("title", ""),
                        "subtitle": info.get("subtitle", ""),
                        "authors": info.get("authors", ["Unknown Author"]),
                        "publisher": info.get("publisher", "Unknown Publisher"),
                        "publication_year": pub_year,
                        "classification_code": "000",
                        "summary": info.get("description", ""),
                        "cover_image_url": cover_url,
                        "source": "Google Books"
                    }
    except Exception as e:
        logger.warning(f"Google Books lookup failed for ISBN {clean_isbn}: {e}")

    return None
