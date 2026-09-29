# Car budget filters

Shoppers can search across makes, choose a £2,000/£5,000/£10,000 maximum-price shortcut, set minimum/maximum prices, and sort live cars by lowest price, highest price, newly listed or best match. New searches start with lowest price and title/condition checks enabled. Sorting can also be changed beside results, using the submitted criteria rather than unsaved form edits.

Live results come from eBay. The API requests the selected provider sort before a bounded batch of 48 cars (parts remain 12). Displayed price sorts then order that batch by GBP purchase price, excluding auction-only bids and unknown prices. The provider's price ordering can include postage, so this is not a guarantee of the cheapest car across eBay or other marketplaces. Results show the scope explicitly.

The optional unwanted-advert check hides obvious parts, breaking/repair, salvage, deposit/monthly-payment and auction-only titles or conditions. It cannot verify roadworthiness, accident history, misleading titles or total costs. Price picks retain their conservative full-car checks even when live-result filtering is disabled.

Minimum/maximum prices, sorting and the explicit hide toggle survive saved-search and saved-listing return links. Legacy saved searches retain their old best-match/no-filter behaviour. eBay handoffs carry price bounds. Other sites explain which filters must be reapplied. Postcode does not filter live-result distance.

Provider references: [eBay Browse search](https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search) and [official OpenAPI specification](https://developer.ebay.com/api-docs/master/buy/browse/openapi/3/buy_browse_v1_oas3.json). The documented sort values are `price`, `-price` and `newlyListed`; an absent sort uses best match. No undocumented negative-query syntax or vehicle attributes are inferred.

Verification covers budget validation, provider sorting and cache separation, shared unwanted-advert checks, numeric price ordering, any-make searches, saved-filter restoration, results counts and immutable submitted criteria. Owner/agent analytics exclusions remain unchanged.
