import type { Guide } from './types';

export const newGuides: Guide[] = [
  {
    slug: 'checking-mot-history',
    title: 'How to check a used car’s MOT history',
    description: 'Read MOT results, mileage entries and advisories, then turn the record into useful questions before buying a used car.',
    category: 'cars',
    publishedAt: '2026-09-28',
    updatedAt: '2026-10-21',
    relatedSlugs: ['buying-a-used-car', 'checking-v5c-logbook', 'avoiding-used-car-scams'],
    intro: [
      'Before you travel to see a car, check its registration on GOV.UK. Look at the expiry date, mileage, failures and advisories, then ask the seller for any repair receipts.',
      'The online history check is free. An MOT pass is not a service history or a guarantee that the car is safe today. Use these checks to decide what still needs a garage’s attention.',
    ],
    sections: [
      {
        id: 'open-the-official-record',
        title: 'Start with the registration number',
        paragraphs: [
          'Open the official service using the button above and enter the number plate. Check that the returned vehicle matches the advert. The history check is free; this does not mean the physical MOT test is free.',
          'Car, motorcycle and van records cover Great Britain tests from 2005 and Northern Ireland tests from 2017. GB records include defect information and downloadable certificates; viewing a test location needs the 11-digit V5C reference. NI certificates cannot be downloaded through this service.',
        ],
        sourceIds: ['mot-history', 'mot-free'],
      },
      {
        id: 'read-every-result',
        title: 'Read the defects as well as the pass or fail',
        paragraphs: [
          'Major or dangerous defects mean a fail. A pass can still include minor defects or advisories. Read each entry and ask what was repaired, when it was done and whether the receipt identifies this car.',
          'An old failure followed by repairs and a pass is different from a current unresolved defect. Do not test-drive a car with an unresolved dangerous defect. Check the linked official rules before driving a vehicle that has failed.',
        ],
        sourceIds: ['mot-result'],
      },
      {
        id: 'compare-mileage',
        title: 'Follow the mileage in date order',
        paragraphs: [
          'Compare consecutive readings, then compare the latest entry with the dashboard and service records. Ask about a decrease, unusual jump or change of units. An odd entry needs investigation; it does not by itself prove mileage fraud.',
          'If the test was within 28 days, the original MOT centre can recheck the vehicle to correct its mileage record. Older errors use DVSA’s reporting process and need evidence dated within one day of the test. Ask the seller to resolve a claimed mistake rather than ignore it.',
        ],
        sourceIds: ['mot-corrections'],
      },
      {
        id: 'understand-the-limits',
        title: 'Use the history alongside maintenance evidence',
        paragraphs: [
          'The MOT is not a service or a full mechanical inspection. It does not cover the condition of the engine, clutch or gearbox, and a pass does not show that scheduled servicing was completed.',
          'Check service dates, repair descriptions and vehicle details on the paperwork separately. Ask a garage about any expensive or unclear mechanical concern before you commit.',
        ],
        sourceIds: ['mot-scope'],
      },
      {
        id: 'gaps-and-expiry',
        title: 'Check gaps, expiry dates and any claimed exemption',
        paragraphs: [
          'For most GB cars, the first MOT is due by the third anniversary of registration, then annually. Check the recorded expiry. Testing up to one month minus one day before expiry keeps the renewal date; testing earlier changes it.',
          'Northern Ireland has different rules and processes. If the last MOT was in NI and the next is in GB, the renewal date is based on the GB test. Use the official guidance for your vehicle rather than assuming all UK tests work identically.',
          'Ask about gaps and any claimed classic-car exemption. GB age-based exemption generally requires a vehicle built or first registered over 40 years ago with no substantial changes in the last 30 years, subject to the full criteria. Age alone is not enough; exempt vehicles must still be roadworthy.',
        ],
        sourceIds: ['mot-timing', 'historic-mot'],
      },
      {
        id: 'prepare-the-viewing',
        title: 'Turn repeated observations into viewing questions',
        paragraphs: [
          'Ask: What was repaired after the last failure? Is there a receipt for the recurring advisory? Does the mileage agree with the dashboard and service records? Take any unanswered question to a garage.',
          'A car can be unsafe with a current MOT. Check its present condition and arrange an independent inspection if you cannot assess a concern. The history alone cannot diagnose it or price a repair.',
        ],
        sourceIds: ['roadworthiness'],
      },
      {
        id: 'finish-the-check',
        title: 'Check recalls and decide what remains unanswered',
        paragraphs: [
          'Check the official recall route too. If a recall may apply, ask the manufacturer what action is needed and whether it has been completed for this car.',
          'Keep your checked registration, date and outstanding questions together. Recheck the live record if a new MOT is promised before collection. Pause the purchase if an unanswered safety or history question could change your decision.',
        ],
        sourceIds: ['recalls'],
      },
    ],
    sources: [
      { id: 'mot-history', title: 'GOV.UK: Check the MOT history of a vehicle', url: 'https://www.gov.uk/check-mot-history' },
      { id: 'mot-free', title: 'DVSA: Free online MOT history and certificates', url: 'https://mattersoftesting.blog.gov.uk/wp-content/uploads/sites/19/2023/12/Encouraging-motorists-to-view-their-certificate-online-toolkit-December-2023.pdf' },
      { id: 'mot-result', title: 'GOV.UK: MOT test result', url: 'https://www.gov.uk/getting-an-mot/after-the-test' },
      { id: 'mot-corrections', title: 'GOV.UK: Fix mistakes on your MOT record', url: 'https://www.gov.uk/getting-an-mot/correcting-mot-certificate-mistakes' },
      { id: 'mot-scope', title: 'GOV.UK: Car parts checked at an MOT', url: 'https://www.gov.uk/government/publications/car-parts-checked-at-an-mot/car-parts-checked-at-an-mot' },
      { id: 'mot-timing', title: 'GOV.UK: When to get an MOT', url: 'https://www.gov.uk/getting-an-mot' },
      { id: 'historic-mot', title: 'GOV.UK: Historic vehicle MOT exemption criteria', url: 'https://www.gov.uk/government/publications/historic-classic-vehicles-mot-exemption-criteria/historic-classic-vehicles-mot-exemption-criteria--2' },
      { id: 'roadworthiness', title: 'GOV.UK: Check your vehicle is safe to drive', url: 'https://www.gov.uk/check-vehicle-safe' },
      { id: 'recalls', title: 'GOV.UK: Check vehicle, part and accessory recalls', url: 'https://www.gov.uk/check-vehicle-recall' },
    ],
  },
  {
    slug: 'checking-v5c-logbook',
    title: 'How to check a V5C log book before buying a car',
    description: 'Compare the V5C with the car and DVLA records, recognise missing information and understand the new keeper handover.',
    category: 'cars',
    publishedAt: '2026-09-28',
    updatedAt: '2026-10-21',
    relatedSlugs: ['buying-a-used-car', 'checking-mot-history', 'avoiding-used-car-scams'],
    intro: [
      'A V5C log book is the vehicle registration certificate. It records the registered keeper and vehicle details, but it is not proof of ownership.',
      'A registration lookup does not give you the 11-digit V5C document reference number. It shows the last V5C issue date. If you need the number because your own log book is lost, follow DVLA’s replacement process.',
      'DVLA advises against buying a car with no log book. Ask the seller to obtain the V5C before you pay, then check it against the car and the independent DVLA record.',
    ],
    sections: [
      {
        id: 'what-the-document-proves',
        title: 'Understand what a V5C can establish',
        paragraphs: [
          'The V5C records registration information and identifies the registered keeper. It is not proof that the person showing it owns the vehicle. DVLA’s buyer-beware explanation makes that distinction explicitly and recommends asking for ownership evidence, such as a bill of sale. Keep the question of registration separate from the seller’s authority to sell.',
          'As a practical step, ask who is selling the car and in what capacity. If someone says they are acting for a relative, company or customer, ask them to explain that arrangement and provide appropriate supporting evidence. Record the explanation with your viewing notes. Do not treat a familiar surname, an impressive folder or possession of the keys as an answer to every ownership question. Resolve uncertainty before arranging the final payment.',
        ],
        sourceIds: ['keeper-and-ownership'],
      },
      {
        id: 'check-the-document',
        title: 'Inspect the actual log book',
        paragraphs: [
          'GOV.UK tells buyers to inspect the V5C for its DVL watermark and check its serial number. The warning ranges are BG8229501–BG9999030 and BI2305501–BI2800000. A document in either range may be stolen; the official advice is to contact the police when safe. Read those as document serial numbers, rather than trying to apply the ranges to the registration or VIN.',
          'Our suggested viewing routine is to ask to see the document itself and allow enough light and time to read it. A photograph sent beforehand can help you prepare questions, but do not let it replace the in-person comparison. If you cannot confidently identify the relevant number or feature, stop and use the linked official guidance. Do not accept a seller’s hurried reading of the details as your own check.',
        ],
        sourceIds: ['used-car-checks'],
      },
      {
        id: 'match-the-car',
        title: 'Compare the VIN and vehicle details',
        paragraphs: [
          'The vehicle identification number is usually stamped into the chassis. DVLA explains that vehicle identity can need assessment where it is in doubt, for example after changes involving the VIN. If locating or reading it is difficult, ask a knowledgeable garage to help identify it; do not guess from a number on an unrelated component.',
          'For your comparison sheet, make separate spaces for the registration, VIN, engine number and descriptive details. Compare the vehicle and document carefully, character by character, following the government’s used-car checks. If the seller explains a mismatch as a modification or replacement engine, ask for the records supporting that explanation. The practical goal is to resolve the discrepancy, not to invent an acceptable amount of difference between two identifiers.',
        ],
        sourceIds: ['vin', 'used-car-checks'],
      },
      {
        id: 'compare-dvla-records',
        title: 'Look up the DVLA record independently',
        paragraphs: [
          'The DVLA vehicle enquiry service uses the number plate and includes details such as fuel type, engine size, registration date and the latest V5C issue date. It does not provide the current keeper’s name as part of this ordinary public check; requests for keeper information use a separate process.',
          'The V5C document reference is an 11-digit number on the log book, not the registration number, VIN or issue date. If your own V5C is lost, use DVLA’s replacement guidance. You must be the registered keeper to apply online, and that service is for cases where the recorded details can stay the same.',
          'Our recommendation is to open the service yourself and note any difference that matters to the advertised car. A recent log book issue should become a question about why it was issued, rather than an automatic accusation. Ask whether the document in front of you is the latest version. Keep the issue date separate from the purchase date or first registration date in your notes, because those labels are answering different questions.',
        ],
        sourceIds: ['dvla-details', 'v5c-reference', 'replacement-log-book'],
      },
      {
        id: 'missing-or-changed-details',
        title: 'Pause over missing documents or unexplained changes',
        paragraphs: [
          'DVLA advises against buying a vehicle without a V5C. A replacement application is not a substitute for inspecting the document before a purchase. If it is missing, our recommendation is to let the seller obtain the right paperwork first, then repeat your checks. There is no need to make their administrative problem part of your transaction.',
          'Changes to details such as colour, engine, cylinder capacity or fuel type can require a V5C update. Use the official change-of-details guidance if the car has been altered. Ask for a clear account of what changed and which records were updated. Avoid making technical judgements from the log book alone: a recorded change and the quality or safety of the work are different matters, and the latter may need a specialist inspection.',
        ],
        sourceIds: ['register-used', 'update-details'],
      },
      {
        id: 'complete-the-handover',
        title: 'Agree the keeper-registration handover',
        paragraphs: [
          'For an ordinary used-vehicle sale, the seller can notify DVLA online or by post and should give you the completed green new keeper slip. Follow the instructions for the version of the V5C being used. Online notification normally brings the new document within five to seven working days; other cases can take longer. Check the details when your document arrives and follow the official missing-document process if necessary.',
          'As a practical handover check, agree the name and address to be recorded and retain the new keeper slip securely. Keep the purchase receipt and any relevant confirmation with your own records. Check that the handover actually follows the agreed method, rather than leaving it as a vague promise to sort out later. If an unexpected paperwork problem appears at collection, pause long enough to understand it.',
        ],
        sourceIds: ['register-used'],
      },
      {
        id: 'tax-and-privacy',
        title: 'Arrange tax and protect the document afterwards',
        paragraphs: [
          'Vehicle tax does not pass to you with the car. Use the official tax service, normally with the green new keeper slip, before driving it. The registration handover and taxing the vehicle are separate tasks. Arrange your insurance and check the other conditions for road use before collection, so the end of the sale does not become a rush to drive away.',
          'DVLA warns against publishing log books online because their identifying details can be misused. Keep yours in a secure place and avoid posting a celebratory photograph that exposes it. Our suggested final check is simple: correct car, understood paperwork, documented seller arrangement, keeper notification completed and road-use arrangements ready. If one of those remains unclear, take the time to resolve it rather than letting the presence of a V5C settle the whole decision.',
        ],
        sourceIds: ['keeper-transfer', 'tax', 'dvla-scams', 'buy-vehicle'],
      },
    ],
    sources: [
      { id: 'keeper-and-ownership', title: 'GOV.UK: DVLA buyer-beware explanation of V5C ownership limits', url: 'https://www.gov.uk/government/speeches/the-re-designed-vehicle-registration-certificate-and-buyer-beware-consumer-protection-initiative' },
      { id: 'used-car-checks', title: 'GOV.UK: Check a used vehicle you are buying', url: 'https://www.gov.uk/checks-when-buying-a-used-car' },
      { id: 'vin', title: 'GOV.UK: Vehicle identification number', url: 'https://www.gov.uk/vehicle-registration/vehicle-identification-number' },
      { id: 'dvla-details', title: 'GOV.UK: Get vehicle information from DVLA', url: 'https://www.gov.uk/get-vehicle-information-from-dvla' },
      { id: 'v5c-reference', title: 'GOV.UK: V5C reference number for vehicle tax', url: 'https://www.gov.uk/tax-vehicle-without-v11-reminder' },
      { id: 'replacement-log-book', title: 'GOV.UK: Get a replacement vehicle log book (V5C)', url: 'https://www.gov.uk/vehicle-log-book' },
      { id: 'register-used', title: 'GOV.UK: Registering new and used vehicles', url: 'https://www.gov.uk/vehicle-registration/new-and-used-vehicles' },
      { id: 'update-details', title: 'GOV.UK: Updating vehicle details on a V5C', url: 'https://www.gov.uk/change-vehicle-details-registration-certificate' },
      { id: 'keeper-transfer', title: 'GOV.UK: Tell DVLA about a vehicle transfer', url: 'https://www.gov.uk/sold-bought-vehicle' },
      { id: 'tax', title: 'GOV.UK: Tax your vehicle', url: 'https://www.gov.uk/vehicle-tax' },
      { id: 'dvla-scams', title: 'GOV.UK: DVLA’s tips for avoiding scams', url: 'https://www.gov.uk/government/news/dvlas-top-tips-for-avoiding-scams' },
      { id: 'buy-vehicle', title: 'GOV.UK: Buy a vehicle step by step', url: 'https://www.gov.uk/buy-a-vehicle' },
    ],
  },
  {
    slug: 'reading-car-part-numbers',
    title: 'How to read and record car part numbers',
    description: 'Capture the complete markings on a part, ask better fitment questions and distinguish a possible match from verified compatibility.',
    category: 'parts',
    publishedAt: '2026-09-28',
    updatedAt: '2026-10-21',
    relatedSlugs: ['finding-the-right-car-part', 'checking-part-compatibility'],
    intro: [
      'Photograph the full label, copy every letter and number, then check that reference against your vehicle before buying. A similar-looking part or nearly matching number is only a starting point.',
      'Mekivo helps you find possible listings. The part maker, supplier or garage must confirm the exact fit; a photo, number match or marketplace compatibility table cannot settle every case.',
    ],
    sections: [
      {
        id: 'record-the-vehicle',
        title: 'Make a vehicle record before a parts record',
        paragraphs: [
          'Write down the make, model, year, engine and fuel type. DVLA can help check basic vehicle details, but its public lookup is not a list of compatible replacement parts.',
          'Keep the VIN, which identifies the vehicle, separate from the number printed on the part. Tell the supplier about relevant modifications. If a requested detail is unknown, ask how to verify it instead of choosing the closest option.',
        ],
        sourceIds: ['dvla-details', 'vin'],
      },
      {
        id: 'capture-the-label',
        title: 'Photograph before transcribing',
        paragraphs: [
          'Take one clear photo of the complete label and one wider photo of the part. Ask your garage for markings that are not safely accessible. Keep the packaging label too.',
          'Copy the whole reference, including leading zeroes, separators and final letters. Mark unclear characters instead of guessing between O and 0. Keep the photo beside your notes so the supplier can check your transcription.',
        ],
        sourceIds: ['business-fake-parts'],
      },
      {
        id: 'do-not-decode-by-guessing',
        title: 'Ask what each marking represents',
        paragraphs: [
          'The same model and year can need different parts. Ask which marking is the ordering reference; do not assume every casting, batch or label number is one. There is no universal rule that a final letter is a revision or similar prefixes guarantee fit.',
          'Check the complete reference against the exact vehicle in the part maker’s catalogue. DENSO, for example, offers vehicle, DENSO/OE-number and VIN lookup for its own range. Read the product’s fitment details; if the VIN is not found, use manual search or manufacturer support.',
          'If a different number is offered as a replacement, ask the supplier for the catalogue or manufacturer evidence behind that substitution before buying.',
        ],
        sourceIds: ['consumer-fake-parts', 'denso-catalogue', 'denso-vin'],
      },
      {
        id: 'build-the-enquiry',
        title: 'Send one complete fitment enquiry',
        paragraphs: [
          'You can copy this into your enquiry: “My vehicle is [make, model, year and engine]. The full part marking is [reference, including final letters]. This is the listing: [link]. Please confirm this exact item fits my vehicle, explain any exclusions and confirm whether the number replaces another reference.”',
          'Attach the label photo. If the supplier needs your VIN, share it privately with that supplier. Ask your installer before ordering customer-supplied parts, including what the job needs and whether they will fit your chosen item. Keep the written reply; it is useful evidence, not an absolute fitment guarantee.',
        ],
        sourceIds: ['consumer-fake-parts'],
      },
      {
        id: 'check-authenticity',
        title: 'Separate identity from authenticity',
        paragraphs: [
          'A matching number does not prove a part is genuine. Both vehicle-branded and aftermarket supply can contain counterfeits; logos, packaging and photos can be copied. Check the seller and use the manufacturer’s authenticity route where available.',
          'Keep the listing, supplier details, receipt and any authenticity response together. Confirm the condition and what is included in the box. Fitment and authenticity are separate questions.',
        ],
        sourceIds: ['consumer-fake-parts', 'business-fake-parts'],
      },
      {
        id: 'look-for-recalls',
        title: 'Check for relevant safety recalls',
        paragraphs: [
          'GOV.UK lets you check recalls for parts and accessories using their manufacturer and model. This is separate from checking the car by registration.',
          'If a notice may apply, ask the manufacturer whether this item or batch is affected and what to do. Do not fit the item while a safety concern is unresolved.',
        ],
        sourceIds: ['recalls'],
      },
      {
        id: 'check-on-arrival',
        title: 'Compare the delivered item before fitting',
        paragraphs: [
          'Compare the delivered reference, condition, quantity and included items with your order and photos before fitting. Ask the seller about any difference and retain packaging and records while resolving it.',
          'Ask a competent garage to resolve technical uncertainty. A current MOT does not make a replacement part safe. If you suspect a counterfeit, preserve photos and follow IPO guidance; use the linked consumer-advice route for a supply dispute.',
        ],
        sourceIds: ['roadworthiness', 'business-fake-parts', 'consumer-rights'],
      },
    ],
    sources: [
      { id: 'dvla-details', title: 'GOV.UK: Get vehicle information from DVLA', url: 'https://www.gov.uk/get-vehicle-information-from-dvla' },
      { id: 'vin', title: 'GOV.UK: Vehicle identification number', url: 'https://www.gov.uk/vehicle-registration/vehicle-identification-number' },
      { id: 'consumer-fake-parts', title: 'GOV.UK: Consumer guidance on fake vehicle parts', url: 'https://www.gov.uk/government/publications/counterfeit-vehicle-parts/consumer-guidance-fake-parts' },
      { id: 'business-fake-parts', title: 'GOV.UK: Business guidance on identifying and reporting fake parts', url: 'https://www.gov.uk/government/publications/counterfeit-vehicle-parts/business-guidance-fake-parts' },
      { id: 'recalls', title: 'GOV.UK: Check vehicle, part and accessory recalls', url: 'https://www.gov.uk/check-vehicle-recall' },
      { id: 'roadworthiness', title: 'GOV.UK: Check your vehicle is safe to drive', url: 'https://www.gov.uk/check-vehicle-safe' },
      { id: 'consumer-rights', title: 'GOV.UK: Consumer rights and advice services', url: 'https://www.gov.uk/consumer-protection-rights' },
      { id: 'denso-catalogue', title: 'DENSO: Official vehicle and parts catalogue', url: 'https://www.denso-am.eu/catalog/pv' },
      { id: 'denso-vin', title: 'DENSO: VIN lookup and fitment information for its own range', url: 'https://www.denso-am.eu/news/denso-aftermarket-makes-part-identification-simple-with-new-vin-search' },
    ],
  },
  {
    slug: 'avoiding-used-car-scams',
    title: 'How to reduce the risk of a used-car scam',
    description: 'Check the seller, car and paperwork independently, recognise pressure around payment and know where to report suspected fraud.',
    category: 'cars',
    publishedAt: '2026-09-28',
    updatedAt: '2026-09-28',
    relatedSlugs: ['buying-a-used-car', 'checking-v5c-logbook', 'checking-mot-history'],
    intro: [
      'Buying a used car involves several separate questions: does the car exist as described, can the seller legitimately sell it, is its condition acceptable, and are you paying the right person on understood terms? A convincing advert does not answer all of them. Work through the questions before allowing a deadline or a promised bargain to decide for you.',
      'This guide combines official checking and reporting routes with practical suggestions for organising a purchase. No checklist guarantees that a transaction is safe. Its purpose is to make missing evidence visible while you can still pause, compare another car or ask an independent professional for help.',
    ],
    sections: [
      {
        id: 'slow-the-decision',
        title: 'Keep payment behind the checks',
        paragraphs: [
          'The government’s Stop! Think Fraud campaign describes advance-payment fraud as collecting money for goods or services that do not exist. Applied to a car search, the practical lesson is to ask what you have independently established before sending a reservation payment, delivery charge or other upfront sum. The label attached to a payment does not verify the transaction.',
          'Set your own sequence: identify the car, investigate the seller, view and inspect, understand the terms, then decide about payment. If someone insists that a payment is the only way to obtain basic evidence, pause. Ask what the money is for, who receives it and what happens if the sale does not proceed. Keep the answer in writing. These are proposed buying habits, not a claim that every deposit request is fraudulent or that every deposit is refundable.',
        ],
        sourceIds: ['fraud-types'],
      },
      {
        id: 'check-the-car-yourself',
        title: 'Run independent checks on the advertised vehicle',
        paragraphs: [
          'GOV.UK’s used-car guidance starts with obtaining the registration, make, model and MOT test number, then comparing DVLA information, MOT history and recalls. Do those checks through the official routes you open yourself. Do not make a screenshot supplied by the seller your only record of the result.',
          'Our recommendation is to keep one note for the advert and another for independently checked facts. Record any mismatch as a question, including differences in description or claimed history. Ask the seller to resolve it before you travel or pay. If the listing is replaced or the registration changes during the conversation, make a fresh comparison. Avoid carrying reassurance from one vehicle across to another just because the seller or photographs look familiar.',
          'When comparing adverts on eBay, Gumtree or another marketplace, keep the original advert addresses with your notes. The same photographs or description on more than one site do not independently confirm the car or seller. Compare the registration, price, seller and collection details, and resolve any differences before travelling or paying.',
        ],
        links: [{ label: 'Plan your shortlist, budget and viewing checks', href: '/guides/buying-a-used-car#prepare-a-shortlist' }],
        sourceIds: ['used-car-checks'],
      },
      {
        id: 'view-and-verify',
        title: 'Inspect identity and condition at the viewing',
        paragraphs: [
          'At the viewing, compare the physical vehicle, its identification details and its V5C. Our log book guide explains the specific document checks. The keeper document alone does not establish ownership, so ask for evidence of the seller’s authority to sell where that is unclear. Treat a refusal to explain a material discrepancy as an unresolved problem, rather than something a lower price automatically fixes.',
          'For condition and history, the Department for Transport recommends service evidence, independent inspection where needed and private history checks covering matters such as finance, theft, mileage discrepancies and write-offs. Check the scope of any report you buy. As a practical rule, use it alongside inspection and paperwork; do not expect one product to answer every question. If repairs are claimed, ask who completed them and what records are available.',
        ],
        sourceIds: ['keeper-and-ownership', 'written-off-checks'],
      },
      {
        id: 'verify-messages',
        title: 'Open government services independently',
        paragraphs: [
          'DVLA warns that messages can imitate official correspondence and ask for payment information or promise vehicle-tax refunds. It recommends using GOV.UK for its services and avoiding public photographs of driving licences or log books. A message arriving during a real vehicle purchase can still be unrelated to that transaction.',
          'Our suggested response to an unexpected “verification” or “release” message is to stop using its links and open the organisation’s known website separately. Check what action, if any, is actually required. Do not upload a log book, identity document or financial information simply because an email uses official-looking branding. Save the message if it appears suspicious. Use the real service’s contact route to resolve uncertainty, rather than asking the sender of the questionable message to confirm that it is genuine.',
        ],
        sourceIds: ['dvla-scams'],
      },
      {
        id: 'plan-collection',
        title: 'Make the final handover explicit',
        paragraphs: [
          'Vehicle tax is not transferred with the car. The buyer needs to tax it before driving, and insurance must also be arranged. Use the official keeper-transfer and tax routes rather than paying a seller an unexplained fee for something described as a government clearance. Ask for the green new keeper slip as part of the normal handover.',
          'Our recommended final comparison is between the agreed car, agreed price, named seller, payment recipient and purchase receipt. If anything has changed, understand why before proceeding. Keep copies of the advert, relevant messages and sale paperwork. Arrange the handover so there is time to check the vehicle again, collect the agreed documents and confirm what has been completed. A rushed collection is a poor moment to discover that the person receiving the money is different from the person you expected.',
        ],
        sourceIds: ['keeper-transfer', 'buy-vehicle', 'register-used'],
      },
      {
        id: 'if-money-has-gone',
        title: 'Contact your bank quickly if you suspect fraud',
        paragraphs: [
          'If you have sent money or think someone has access to your account, the government campaign advises contacting your bank or payment provider as soon as possible. Use a trusted number, such as the one on your card, instead of a number supplied by the suspected fraudster. Explain the payment and why you are concerned. Do not assume a refund is guaranteed.',
          'Our suggested evidence bundle contains the advert address, seller details, messages, payment amount and time, receiving details, vehicle registration and a short chronological account. Keep the original records as well as your summary. This helps you explain the same facts consistently to the bank, marketplace and police. Be cautious about a new approach offering to recover the money for an upfront fee: the official campaign identifies that as another form of advance-payment fraud.',
        ],
        sourceIds: ['report-fraud', 'fraud-types'],
      },
      {
        id: 'report-and-get-advice',
        title: 'Use the right reporting and advice route',
        paragraphs: [
          'For online fraud losses, the current GOV.UK guidance directs people in England and Wales to Report Fraud and people in Scotland to Police Scotland. The government campaign also links to the national reporting service. Use those pages for the current route relevant to where you live. If anyone is in immediate danger, call 999. Reporting a crime and asking your bank to act are separate steps.',
          'Suspicious emails can be forwarded to report@phishing.gov.uk and suspicious texts to 7726. Report the advert to the platform as well. If the problem is a dispute about a vehicle’s condition or description, the GOV.UK consumer-rights page directs you to Citizens Advice in England and Wales, Advice Direct Scotland, or Consumerline in Northern Ireland. Describe the facts and seller type; get advice on the specific purchase rather than assuming that a private sale and a dealer sale have identical remedies.',
        ],
        sourceIds: ['phishing', 'report-fraud', 'consumer-rights'],
      },
    ],
    sources: [
      { id: 'fraud-types', title: 'GOV.UK campaign: Recognising types of fraud', url: 'https://stopthinkfraud.campaign.gov.uk/how-to-spot-fraud/stay-alert-to-fraud/' },
      { id: 'used-car-checks', title: 'GOV.UK: Check a used vehicle you are buying', url: 'https://www.gov.uk/checks-when-buying-a-used-car' },
      { id: 'keeper-and-ownership', title: 'GOV.UK: DVLA buyer-beware explanation of V5C ownership limits', url: 'https://www.gov.uk/government/speeches/the-re-designed-vehicle-registration-certificate-and-buyer-beware-consumer-protection-initiative' },
      { id: 'written-off-checks', title: 'GOV.UK: Pre-purchase checks for repaired written-off vehicles', url: 'https://www.gov.uk/government/publications/buying-repaired-written-off-vehicles-a-consumer-guide/buying-repaired-written-off-vehicles-a-consumer-guide#before-purchase' },
      { id: 'dvla-scams', title: 'GOV.UK: DVLA’s tips for avoiding scams', url: 'https://www.gov.uk/government/news/dvlas-top-tips-for-avoiding-scams' },
      { id: 'keeper-transfer', title: 'GOV.UK: Tell DVLA about a vehicle transfer', url: 'https://www.gov.uk/sold-bought-vehicle' },
      { id: 'buy-vehicle', title: 'GOV.UK: Buy a vehicle step by step', url: 'https://www.gov.uk/buy-a-vehicle' },
      { id: 'register-used', title: 'GOV.UK: Registering new and used vehicles', url: 'https://www.gov.uk/vehicle-registration/new-and-used-vehicles' },
      { id: 'report-fraud', title: 'GOV.UK campaign: Reporting fraud and contacting your bank', url: 'https://stopthinkfraud.campaign.gov.uk/reporting-fraud/' },
      { id: 'phishing', title: 'GOV.UK: Report internet scams and phishing', url: 'https://www.gov.uk/report-suspicious-emails-websites-phishing' },
      { id: 'consumer-rights', title: 'GOV.UK: Consumer rights and advice services', url: 'https://www.gov.uk/consumer-protection-rights' },
    ],
  },
];
