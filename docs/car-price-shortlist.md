# Car price shortlist

Car searches on All platforms or eBay show up to three eligible matches from the existing eBay response, ordered by their advertised GBP price. This is a comparison aid within the returned results, not a claim to find the cheapest car on the market, an inspection, or a seller recommendation. Other marketplace links remain available.

The shortlist uses the submitted make, model, year and maximum price, not later edits to the form. It requires a positive GBP price and a fixed-price or classified buying option. Auction-only offers, expired listings, unsafe listing links, duplicates and clear parts/deposit/monthly-payment/salvage wording are excluded. A dual auction/Buy It Now listing can qualify using its purchase price. `currentBidPrice` is never used.

The title checks are conservative heuristics; search summaries cannot establish a car's full condition, history or all payable charges. The UI tells visitors to verify those details on the original listing. A gap below the visitor's maximum is labelled as such, never as a discount or saving. Fees and delivery are excluded.

No additional upstream requests, browser trackers, credentials or paid services are introduced. Shortlist links keep the established affiliate disclosure and existing outbound-event policy, including owner/testing exclusions. Ordinary car and parts results remain intact.

Official field references:

- [eBay Browse integration guide](https://developer.ebay.com/api-docs/buy/static/api-browse.html)
- [Buying-option filters](https://developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html)
- [Purchase price versus current bid](https://developer.ebay.com/develop/guides/buy/checkout-bid-guide)

Validation: run the Node test suite, lint and production build. Preview loading, error, empty and matching states locally; use an analytics-excluded browser for any production QA, as described in AGENTS.md.
