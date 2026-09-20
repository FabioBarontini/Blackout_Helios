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


## Laboratori interattivi BLACKOUT
La versione integrata aggiunge una voce **Laboratori** al sito principale con tre prove:
1. **Build the Network** — costruzione drag & drop della rete, collegamenti, test di comunicazione e verifica progressiva.
2. **The Message** — attività discovery: gli studenti devono capire quali informazioni aggiungere a un contenuto per farlo arrivare, distinguere comunicazioni contemporanee e ricostruire parti.
3. **Invisible Services** — quattro situazioni-problema con verifica su DHCP, DNS, HTTP e HTTPS.

I laboratori non mostrano nella prima fase i nomi dei campi tecnici del messaggio.


### Correzione Laboratorio 1
Gli elementi dell'inventario sono ora realmente trascinabili nel tavolo di lavoro. I nodi già posizionati possono essere trascinati senza interrompere il movimento; i collegamenti restano aggiornati durante lo spostamento. Il click sull'inventario resta disponibile come alternativa.


### Correzione collegamenti LAB 1
I collegamenti possono essere selezionati cliccandoci sopra. Un collegamento selezionato può essere eliminato con il pulsante **ELIMINA COLLEGAMENTO** oppure con il tasto **CANC**. La selezione usa una zona cliccabile più ampia della linea visibile per facilitare l'uso in classe.


### Regola collegamenti LAB 1
CLIENT e SERVER hanno al massimo un collegamento diretto; SWITCH e ROUTER possono avere più collegamenti. Il controllo impedisce di creare connessioni aggiuntive non valide.

### Revisione pedagogica LAB 1 e LAB 3
LAB 1: le missioni descrivono i problemi funzionali senza anticipare il nome del componente (molti dispositivi, risorsa condivisa, reti separate).
LAB 3: non vengono più proposti i nomi DHCP/DNS/HTTP/HTTPS come opzioni. Gli studenti scelgono comportamenti/funzioni, osservano una traccia e arrivano al significato; il docente introduce il nome tecnico solo dopo.


### Correzione v6
Risolto un errore JavaScript nel LAB 1 che impediva l'inizializzazione dell'intero sito. Il menu e tutte le pagine tornano a essere caricati correttamente.
