# BLACKOUT — HELIOS CORP. EXTENDED

Questa versione mantiene la grafica del sito originale fornito e ne amplia i contenuti.

## Contenuti
- Briefing narrativo ampliato
- 5 fascicoli con ritratti fittizi
- PCAP inclusi
- Wireshark Survival Kit ampliato
- Registro digitale delle prove
- Verdetto senza rivelazione della soluzione agli studenti
- Raccolta centralizzata tramite Google Apps Script + Google Sheet
- Console Admin per il docente
- Punteggio automatico preliminare:
  - 40 punti sospettato corretto
  - 20 metodo/ricostruzione
  - 25 qualità delle prove
  - 15 precisione tecnica

Il punteggio automatico è pensato come base: il docente può correggerlo nella Google Sheet dopo aver letto le risposte.

## Raccolta centralizzata

1. Crea un Google Sheet.
2. Apri Estensioni -> Apps Script.
3. Incolla `apps_script_Code.gs`.
4. Cambia `ADMIN_TOKEN`.
5. Distribuisci come Web App:
   - Esegui come: te stesso
   - Accesso: chiunque
6. Copia l'URL della Web App in `config.js`:
   `SUBMIT_ENDPOINT: "..."`

Le squadre inviano il rapporto con POST.
Il sito non mostra la soluzione dopo l'invio.

## Console docente

Apri il sito -> Admin.
Inserisci:
- URL Web App
- ADMIN TOKEN

La console mostra tutte le squadre, le risposte e i punteggi.

## Nota sulle foto

I ritratti inclusi sono **ritratti grafici fittizi**, creati per evitare l'uso di fotografie di persone reali. Possono essere sostituiti in seguito con immagini fotografiche generate appositamente mantenendo gli stessi nomi file.

## Pubblicazione

Il progetto è statico e può essere pubblicato su Vercel.
