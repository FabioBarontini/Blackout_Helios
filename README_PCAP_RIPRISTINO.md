# BLACKOUT Helios — ripristino PCAP 2ª / 3ª

Questa build separa fisicamente i PCAP dei due percorsi didattici.

## Seconda
I cinque PCAP forniti come originali sono in:

`pcap/second/`

- elena-rossi.pcap
- luca-chen.pcap
- marco-ferretti.pcap
- sara-colombo.pcap
- david-okafor.pcap

`second.html` punta esclusivamente a questi file.

## Terza
I PCAP presenti nella build v18.4 precedente sono stati conservati in:

`pcap/third/`

- elena-rossi.pcap
- luca-chen.pcap
- marco-ferretti.pcap
- sara-colombo.pcap
- david-okafor.pcap
- network-core.pcap

`third.html` punta esclusivamente a questi file.

## Importante
I due percorsi possono usare gli stessi nomi logici dei sospettati senza più sovrascriversi, perché i file sono in cartelle differenti.
Il database Supabase non viene modificato da questa operazione.
