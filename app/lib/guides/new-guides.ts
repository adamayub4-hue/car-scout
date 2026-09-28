import type { Guide } from './types';

export const newGuides: Guide[] = [
  {
    slug: 'checking-mot-history',
    title: 'How to check a used car’s MOT history',
    description: 'Read MOT results, mileage entries and advisories, then turn the record into useful questions before buying a used car.',
    category: 'cars',
    publishedAt: '2026-09-28',
    updatedAt: '2026-09-28',
    relatedSlugs: ['buying-a-used-car', 'checking-v5c-logbook', 'avoiding-used-car-scams'],
    intro: [
      'An MOT history is most useful when you read it as a sequence of events. A recent pass is one piece of information; earlier failures, recorded distances and the seller’s repair paperwork help you decide what to ask next. This guide explains how to make those comparisons without treating a test result as a guarantee about the whole car.',
      'Keep a short note for each car you shortlist: registration, latest test date, expiry date, unresolved questions and supporting receipts you want to see. The practical examples below are suggestions for organising your checks. The linked government pages explain the official services and test rules.',
    ],
    sections: [
      {
        id: 'open-the-official-record',
        title: 'Start with the registration number',
        paragraphs: [
          'Open the GOV.UK MOT history service yourself and enter the number plate. It shows test outcomes, recorded mileage and the next due date. For cars, motorcycles and vans, the available history covers tests in Great Britain from 2005 and Northern Ireland from 2017. These starting dates matter when assessing an older car: an empty earlier period is not automatically evidence of missing tests.',
          'For tests in England, Scotland and Wales, the service also provides certificates and defect information. Viewing the test location requires the 11-digit V5C reference. Northern Ireland certificates cannot be downloaded through this service. As a practical first check, compare the returned vehicle with the advert before reading further; if you have typed a character incorrectly, correct that before questioning the seller.',
        ],
        sourceIds: ['mot-history'],
      },
      {
        id: 'read-every-result',
        title: 'Read the defects as well as the pass or fail',
        paragraphs: [
          'A major or dangerous defect produces a failure. Minor problems and advisory observations can appear alongside a pass, so the green result alone does not tell you everything. Read the full entry and note which component and location are mentioned. A note about one tyre is a different question from several entries involving steering or braking.',
          'Our suggested approach is to put each point into one of three working groups: evidence of a completed repair, something a garage should inspect, or information still missing. Do not assign repair prices from the wording alone. Ask the seller what was done, on what date, and whether a receipt identifies the work. This turns an alarming list into specific questions without pretending that an online history diagnoses the car.',
        ],
        sourceIds: ['mot-result'],
      },
      {
        id: 'compare-mileage',
        title: 'Follow the mileage in date order',
        paragraphs: [
          'Write down the distance shown at consecutive tests and compare the latest entry with the dashboard at the viewing. As a checking method, note any decrease, unexpectedly large change or apparent change of units. Ask for an explanation and dated evidence. An odd entry is a reason to investigate, rather than proof by itself that someone has altered the mileage.',
          'DVSA provides a correction process for genuine mistakes. Within 28 days, the testing centre can check the vehicle again and update an incorrect mileage entry. Older mistakes need supporting evidence through the official process; the evidence must establish the correct mileage and be dated within one day of the test. If a seller says an entry is wrong, ask them to resolve it through that process instead of asking you to ignore it.',
        ],
        sourceIds: ['mot-corrections'],
      },
      {
        id: 'understand-the-limits',
        title: 'Use the history alongside maintenance evidence',
        paragraphs: [
          'The MOT does not assess the car’s general mechanical condition in the way a service or buying inspection might. DVSA specifically excludes the condition of the engine, clutch and gearbox from the test. A pass therefore cannot answer every question about an expensive mechanical problem, or show that scheduled maintenance has been completed.',
          'For your viewing, create a separate maintenance list: service records offered, work the seller says has been completed, and anything a mechanic needs to explain. Keep that list separate from the MOT observations so that one does not stand in for the other. If a receipt is offered as evidence, read its description and vehicle details rather than counting the number of pages in the folder. Ask what the paperwork actually establishes.',
        ],
        sourceIds: ['mot-scope'],
      },
      {
        id: 'gaps-and-expiry',
        title: 'Check gaps, expiry dates and any claimed exemption',
        paragraphs: [
          'For most cars in Great Britain, the first MOT is due by the third anniversary of registration, followed by annual tests. Northern Ireland has different rules and processes. Check the actual expiry date rather than estimating it from the month of the last test. A test taken early can change the renewal date, depending on when it was taken.',
          'For a classic car, ask why the seller says no MOT is needed. Current Great Britain guidance allows an age-based exemption where the vehicle was built or first registered more than 40 years ago and has not been substantially changed within the previous 30 years. Read the full criteria for the individual vehicle. Our recommendation is to ask for the history behind any gap; do not fill it with assumptions about storage, restoration or exemption.',
        ],
        sourceIds: ['mot-timing', 'historic-mot'],
      },
      {
        id: 'prepare-the-viewing',
        title: 'Turn repeated observations into viewing questions',
        paragraphs: [
          'Suppose successive tests mention the same area of corrosion. A useful question is whether it has been inspected or repaired, and what evidence is available. If several tyre observations appear across different years, ask about the current tyres and any related work. These are prompts for a competent inspection, not conclusions about the cause or likely cost.',
          'GOV.UK makes clear that a car can be unsafe despite holding a current MOT. At the viewing, treat present condition as a separate check: lights, visibility, brakes and tyres still matter. If you cannot assess an issue, arrange an independent inspection before committing. A seller’s willingness to discuss the history is useful context, but a reassuring conversation is not a substitute for evidence about the vehicle in front of you.',
        ],
        sourceIds: ['roadworthiness'],
      },
      {
        id: 'finish-the-check',
        title: 'Check recalls and decide what remains unanswered',
        paragraphs: [
          'Use the official recall route as a separate step. A registration search can show outstanding safety recalls, while a model search uses the manufacturer, model and year. If an entry appears, ask the manufacturer or its representative to explain the required action and whether it has been completed for this car.',
          'Before deciding, review your note rather than simply asking whether the car has passed. Can you explain the mileage sequence? Have important repair claims been supported? Is any present safety concern unresolved? Our suggested decision rule is to pause whenever an unanswered point could materially change your willingness to buy. Keep the history you checked with the date of your check, and revisit the live record if the seller promises a new test before collection.',
        ],
        sourceIds: ['recalls'],
      },
    ],
    sources: [
      { id: 'mot-history', title: 'GOV.UK: Check the MOT history of a vehicle', url: 'https://www.gov.uk/check-mot-history' },
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
    updatedAt: '2026-09-28',
    relatedSlugs: ['buying-a-used-car', 'checking-mot-history', 'avoiding-used-car-scams'],
    intro: [
      'Treat a log book check as a comparison between three things: the document, the physical car and the information available independently from DVLA. Reading only the registration on the cover misses the point. You want a consistent account of which vehicle is being sold and a clear plan for recording the change of keeper.',
      'Set aside time for this before paying. The workflow below includes practical ways to organise the comparison, alongside links to the government guidance behind the document checks. If the seller cannot resolve a discrepancy, postponing the purchase leaves you room to establish the facts without also having to recover money.',
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
          'Our recommendation is to open the service yourself and note any difference that matters to the advertised car. A recent log book issue should become a question about why it was issued, rather than an automatic accusation. Ask whether the document in front of you is the latest version. Keep the issue date separate from the purchase date or first registration date in your notes, because those labels are answering different questions.',
        ],
        sourceIds: ['dvla-details'],
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
    updatedAt: '2026-09-28',
    relatedSlugs: ['finding-the-right-car-part', 'checking-part-compatibility'],
    intro: [
      'A clear record of the number on an existing part can make a parts enquiry much more precise. The useful skill is to preserve the complete information and ask the right person to interpret it. Do not turn a partly readable label into a confident order just because a search result looks similar.',
      'This guide offers Mekivo’s practical recording and comparison workflow. It is not a government part-number decoder, and it does not claim that a prefix, suffix or sequence has one meaning across manufacturers. GOV.UK sources below support the vehicle-identification, counterfeit-parts and safety guidance; a manufacturer, authorised distributor or competent garage must resolve the technical fitment of a particular part.',
    ],
    sections: [
      {
        id: 'record-the-vehicle',
        title: 'Make a vehicle record before a parts record',
        paragraphs: [
          'DVLA’s public vehicle service can help you check basic information including engine size, fuel type and manufacture year. Its VIN guidance concerns the identity of the whole vehicle. Neither page is a catalogue saying which replacement component fits a particular car, so use that information to describe the vehicle when asking for help.',
          'For your own enquiry sheet, put the registration and VIN in a vehicle section, then add the model description and any relevant modification the installer tells you about. Put component markings in a separate section. This prevents an easy communication error: sending a vehicle identifier when the supplier requested a part marking, or the reverse. If you do not know a requested specification, mark it unknown and ask how to verify it instead of choosing the closest-looking option.',
        ],
        sourceIds: ['dvla-details', 'vin'],
      },
      {
        id: 'capture-the-label',
        title: 'Photograph before transcribing',
        paragraphs: [
          'The Intellectual Property Office recommends photographing parts, packaging and labels when reporting a suspected counterfeit. We suggest using the same evidence habit while identifying an ordinary purchase: save a clear view of the complete label and a wider view showing which component it belongs to. Do this only where the markings are safely accessible; ask the installer to record anything that requires removal.',
          'Copy each visible line exactly into your notes, retaining spaces, dashes, leading zeroes and final letters. Record uncertainty explicitly: for example, “third character unclear in photograph”. Take another image or ask the supplier rather than silently changing a letter O to a zero. Keep the photograph beside your transcription so another person can check it. Our workflow does not assign a technical meaning to every line; it preserves the evidence for someone who can.',
        ],
        sourceIds: ['business-fake-parts'],
      },
      {
        id: 'do-not-decode-by-guessing',
        title: 'Ask what each marking represents',
        paragraphs: [
          'GOV.UK consumer guidance notes that even cars sharing a model and year can need different parts. That is a useful reason to resist the leap from a similar number to a confirmed match. Treat all visible markings as unidentified until the supplier explains which one is the ordering reference for the component you need.',
          'Our suggested questions are: which number should I order against; does every character matter for this application; and, if the proposed replacement carries a different reference, where is that equivalence documented? Do not invent a rule that a final letter is always a revision, a longer number is always newer, or the same first digits guarantee compatibility. A seller’s explanation should refer to this part and this vehicle. Save the answer with the images so it remains available when you compare another listing.',
        ],
        sourceIds: ['consumer-fake-parts'],
      },
      {
        id: 'build-the-enquiry',
        title: 'Send one complete fitment enquiry',
        paragraphs: [
          'The IPO advises buyers who are unsure to seek help from a trusted garage, authorised dealership or parts distributor. It also warns that garages can be cautious about fitting customer-supplied parts. Speak to the person doing the repair before committing to a purchase, including whether they will accept your proposed source.',
          'For the enquiry itself, send the vehicle information, full transcribed marking, photographs and the exact listing under consideration. Ask the supplier to confirm suitability in writing and identify the evidence used. Ask the installer what else is needed to complete the job and whether the listing includes it. This is a suggested communication method, not a promise that a written response guarantees fitment. If the answer only repeats the advert’s broad model range, ask the unresolved question again rather than treating repetition as confirmation.',
        ],
        sourceIds: ['consumer-fake-parts'],
      },
      {
        id: 'check-authenticity',
        title: 'Separate identity from authenticity',
        paragraphs: [
          'A plausible number is not, by itself, a reason to trust the seller. IPO guidance explains that both manufacturer-branded and aftermarket supply can be affected by counterfeits. Its business guidance links to manufacturer tools for checking authenticity. Use a relevant official manufacturer route where one is available, rather than assuming that a copied logo or printed code settles the question.',
          'Our suggested comparison has two separate answers: “the supplier confirms the specification” and “I understand who is supplying it”. Save the listing, seller identity, receipt and any authenticity response together. Ask what arrives in the box, whether the photographs show the actual item, and what the stated condition means. If the supplier changes during the conversation, repeat the source checks; the evidence collected for one seller should not silently become evidence for another.',
        ],
        sourceIds: ['consumer-fake-parts', 'business-fake-parts'],
      },
      {
        id: 'look-for-recalls',
        title: 'Check for relevant safety recalls',
        paragraphs: [
          'The government recall service covers parts and accessories as well as complete vehicles. Its parts search uses the manufacturer and model. That makes accurate identification useful beyond shopping: it can help you ask whether a safety notice applies to what you are considering. A parts search and a registration-based car recall search answer different questions.',
          'As a practical follow-up, save the wording or reference of a potentially relevant notice and ask the manufacturer whether the proposed item is affected. Do not try to decide an unclear match by comparing only a fragment of the number. If there is an unresolved safety concern, leave the item unfitted while you get advice. The aim of your notes is to make that conversation precise, not to replace a recall decision by the manufacturer.',
        ],
        sourceIds: ['recalls'],
      },
      {
        id: 'check-on-arrival',
        title: 'Compare the delivered item before fitting',
        paragraphs: [
          'Roadworthiness remains the driver’s responsibility, and a current MOT does not make every part choice safe. Leave decisions about installation and safety to a competent person where you cannot establish them yourself. Recording a number is preparation for that decision; it is not a repair instruction.',
          'Our arrival check is to place the order confirmation, saved photographs and new item together. Compare the complete reference and the description you agreed, then ask about any unexpected difference before fitting. Keep packaging and records while resolving it. If the part seems fake, preserve photographs and follow the IPO reporting route. For an ordinary supply dispute, the GOV.UK consumer-rights page points to advice services in each UK nation. Explain what was promised, what arrived and what evidence you retained, rather than relying only on “it looks wrong”.',
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
        ],
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
