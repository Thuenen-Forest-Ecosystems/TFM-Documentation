import {
    AbstractPowerSyncDatabase,
    BaseObserver,
    CrudEntry,
    type PowerSyncBackendConnector,
    UpdateType
  } from '@powersync/web';
  
  import type { Session } from '@supabase/supabase-js';
  import { SupabaseClient, createClient } from '@supabase/supabase-js';

  //import { config } from './config.js';
  
  export type SupabaseConfig = {
    supabaseUrl: string;
    supabaseAnonKey: string;
    powersyncUrl: string;
  };
  
  /// Postgres Response codes that we cannot recover from by retrying.
  const FATAL_RESPONSE_CODES = [
    // Class 22 — Data Exception
    // Examples include data type mismatch.
    new RegExp('^22...$'),
    // Class 23 — Integrity Constraint Violation.
    // Examples include NOT NULL, FOREIGN KEY and UNIQUE violations.
    new RegExp('^23...$'),
    // INSUFFICIENT PRIVILEGE - typically a row-level security violation
    new RegExp('^42501$')
  ];
  
  export type SupabaseConnectorListener = {
    initialized: () => void;
    sessionStarted: (session: Session) => void;
  };
  
  export class SupabaseConnector extends BaseObserver<SupabaseConnectorListener> implements PowerSyncBackendConnector {
    readonly client: SupabaseClient;
    readonly config: SupabaseConfig;
  
    ready: boolean;
  
    currentSession: Session | null;
  
    constructor(supabaseUrl, supabaseAnonKey, powersyncUrl) {
      super();

      console.log(supabaseUrl);
      
      this.config = {
        supabaseUrl: supabaseUrl,
        powersyncUrl: powersyncUrl,
        supabaseAnonKey: supabaseAnonKey
      };
  
      this.client = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
        auth: {
          persistSession: true
        }
      });
      this.currentSession = null;
      this.ready = false;
    }
  
    async init() {
      if (this.ready) {
        return;
      }

      const sessionResponse = await this.client.auth.getSession();
       
      this.updateSession(sessionResponse.data.session);
  
      this.ready = true;
      this.iterateListeners((cb) => cb.initialized?.());
      console.log('init successfull');
    }
  
    async login(username: string, password: string) {
      const {
        data: { session },
        error
      } = await this.client.auth.signInWithPassword({
        email: username,
        password: password
      });
  
      if (error) {
        throw error;
      }
  
      this.updateSession(session);
      console.log('init successfull');
    }
  
    async fetchCredentials() {
      const {
        data: { session },
        error
      } = await this.client.auth.getSession();
  
      if (!session || error) {
        throw new Error(`Could not fetch Supabase credentials: ${error}`);
      }
  
      console.debug('session expires at', session.expires_at);
  
      return {
        endpoint: this.config.powersyncUrl,
        token: session.access_token ?? ''
      };
    }

    prepareDataForUpload(record: any, table: string): any {

      if(table == 'features'){
        if(record.properties){
          record.properties = JSON.parse(record.properties);
        }
        /*if(record.geometry){
          record.geometry = JSON.parse(record.geometry);
        }*/
      }

      return record;
    }
  
    async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
      const transaction = await database.getNextCrudTransaction();
      console.log('Transaction to upload:', transaction);
      if (!transaction) {
        console.debug('No transaction to upload');
        return;
      }
  
      let lastOp: CrudEntry | null = null;
      try {
        // Note: If transactional consistency is important, use database functions
        // or edge functions to process the entire transaction in a single call.
        for (const op of transaction.crud) {
          lastOp = op;
          const table = this.client.from(op.table);
          let result: any;
          switch (op.op) {
            case UpdateType.PUT:
              const record = { ...op.opData, id: op.id };
              const recordPut = this.prepareDataForUpload(record, op.table);

              const newArray = JSON.parse(record['cluster_ids'] ?? '[]');
              console.log('newArray:', newArray);

              result = await table.upsert(recordPut);
              console.log('PUT result:', result);
              break;
            case UpdateType.PATCH:
              const recordUpdate = this.prepareDataForUpload(op.opData, op.table);
              result = await table.update(recordUpdate).eq('id', op.id);
              console.log('PATCH result:', result, recordUpdate);
              break;
            case UpdateType.DELETE:
              result = await table.delete().eq('id', op.id);
              break;
          }
  
          if (result.error) {
            if(result.error.code == 'P0001'){
              console.error('P0001', result.error, op.id, op);
              //db.execute(`UPDATE ${op.table} SET error = ? WHERE id = ?`, [JSON.stringify(result.error), op.id]);
              continue;
            }
            

            throw result.error;
          }
        }
  
        await transaction.complete();
        console.debug('Transaction complete');
      } catch (ex: any) {
        console.debug(ex);
        if (typeof ex.code == 'string' && FATAL_RESPONSE_CODES.some((regex) => regex.test(ex.code))) {
          /**
           * Instead of blocking the queue with these errors,
           * discard the (rest of the) transaction.
           *
           * Note that these errors typically indicate a bug in the application.
           * If protecting against data loss is important, save the failing records
           * elsewhere instead of discarding, and/or notify the user.
           */
          console.error('Data upload error - discarding:', lastOp, ex);
          await transaction.complete();
        } else {
          // Error may be retryable - e.g. network error or temporary server error.
          // Throwing an error here causes this call to be retried after a delay.
          throw ex;
        }
      }
    }
  
    updateSession(session: Session | null) {
      this.currentSession = session;
      if (!session) {
        return;
      }
      this.iterateListeners((cb) => cb.sessionStarted?.(session));
    }
  }