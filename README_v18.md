# BLACKOUT // Helios v18

Versione unica con due percorsi didattici e un unico database Supabase.

## Accesso
- `index.html` = terminale iniziale.
- La squadra indica **classe 2ª o 3ª**.
- La squadra viene indirizzata a `second.html` oppure `third.html`.
- Le squadre e i progressi restano nello stesso progetto Supabase.
- L'account docente può entrare dalla console docente e viene portato a `third.html?admin=1`.

## Percorso 2ª
`second.html` conserva l'impostazione precedente dei laboratori Helios/BLACKOUT. È stato collegato al database comune per progressi e verdetto.

## Percorso 3ª
`third.html` contiene:
- i tre laboratori di scoperta già presenti;
- tre sfide extra non valutate per preparare viaggio del pacchetto, porte/comunicazioni e lettura di tracce;
- indagine PCAP più articolata;
- cinque sospetti + `network-core.pcap`;
- verdetto avanzato con ricostruzione temporale, sospetto alternativo e limiti dell'evidenza.

## PCAP
I sei PCAP sono validi file PCAP Ethernet e possono essere aperti con Wireshark.

## Supabase
Prima del deploy eseguire nel SQL Editor:
1. il precedente schema/migrazioni già usati nel progetto;
2. `supabase-migration-class-and-v2.sql`.

La migrazione assegna inizialmente `class_level=2` alle squadre già esistenti. Se una squadra già presente deve essere trattata come terza, modificarne manualmente il valore:

```sql
update public.teams
set class_level = 3
where name = 'NOME_SQUADRA';
```

Non inserire mai una service-role key nel frontend.
