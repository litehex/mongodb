import {
   BulkWriteOptions,
   Collection,
   CollectionOptions,
   Db,
   DeleteOptions,
   DeleteResult,
   Document,
   Filter as MongoFilter,
   FindOptions,
   InsertManyResult,
   InsertOneOptions,
   InsertOneResult,
   MongoClient,
   MongoError,
   UpdateOptions
} from 'mongodb';
import MongoDB, { Filter, FindCursor, LeastOne, OptionalId, UpdateQuery, UpdateResult } from "./index";


export interface CollectionConfig extends CollectionOptions {
   name: string;
   database: string | Db;
   client?: MongoClient;
   // Timestamps - By default, the collection will add createdAt and updatedAt fields to the documents
   timestamps?: boolean;
   // Timestamps (format) - By default, the collection will use the Millis format for the timestamps
   timestampsFormat?: 'ISODate' | 'Millis' | 'Unix' | 'Date' | 'Utc';
   // Timestamps (fields) - By default, the collection will use createdAt and updatedAt fields for the timestamps
   timestampsFields?: LeastOne<{
      createdAt: string;
      updatedAt: string;
   }>;
}

/**
 * The MongoCollection class is a abstraction of the MongoDB Collection class.
 * It provides a easy way to create and manage collections.
 *
 * @public
 *
 * @example
 * import MongoCollection from "@litehex/mongodb/dist/collection";
 *
 * export class Reservations extends MongoCollection {
 *
 *    getConfig(): CollectionConfig {
 *       return {
 *          name: "reservations",
 *          database: "example",
 *       }
 *    }
 *
 *    static doSomething() {
 *       this.collection().find({}).toArray();
 *    }
 *
 * }
 */
export default abstract class MongoCollection<TSchema extends Document = Document> {

   private static _updateTimestamps(document: Document, isInsert: boolean) {
      if (this._getConfig().timestamps) {

         const format = this._getConfig().timestampsFormat || 'Millis';
         const formattedDate = this._formatDate(new Date(), format);

         const fields = this._getConfig().timestampsFields || {
            createdAt: 'createdAt',
            updatedAt: 'updatedAt'
         };

         if (isInsert && fields.createdAt && !document[fields.createdAt]) {
            document[fields.createdAt] = formattedDate;
         }

         if (isInsert && fields.updatedAt && !document[fields.updatedAt]) {
            document[fields.updatedAt] = formattedDate;
         }

         if (!isInsert && fields.updatedAt) {
            if (!document['$set']) {
               document['$set'] = {};
            }

            if (!document['$set'][fields.updatedAt]) {
               document['$set'][fields.updatedAt] = formattedDate;
            }
         }

      }
      return document;
   }

   /**
    * Date Formats:
    *
    * ISODate: "2022-12-05T04:14:52.618Z"
    * Date: 2022-12-05T04:14:52.618Z
    * Unix: 163869729261
    * Millis: 1638697292618
    * Utc: "Mon, 05 Dec 2022 04:14:52 GMT"
    *
    * @param {Date} date The date to format.
    * @param {string} format The format to use.
    * @private
    */
   private static _formatDate(date: Date, format: 'ISODate' | 'Millis' | 'Unix' | 'Date' | 'Utc') {
      switch (format) {
         case 'ISODate':
            return date.toISOString();
         case 'Date':
            return date;
         case 'Unix':
            return Math.floor(date.getTime() / 1000);
         case 'Millis':
            return date.getTime();
         case 'Utc':
            return date.toUTCString();
      }
   }

   /**
    * Get the collection configuration.
    *
    * **NOTE:** This method must be implemented in the child class.
    *
    * @returns {CollectionConfig} The collection configuration.
    */
   abstract getConfig(): CollectionConfig;

   /**
    * Get the collection configuration.
    * @private
    */
   private static _getConfig(): CollectionConfig {
      if (!this.prototype.getConfig) {
         throw new MongoError("The getConfig() method is not implemented in the child class");
      }
      return this.prototype.getConfig();
   }

   /**
    * Get the collection instance.
    *
    * @returns {Collection<Document>} The collection instance.
    */
   static getCollection<TSchema extends Document = Document>(): Collection<TSchema> {
      return this.getDb().collection<TSchema>(this.getCollectionName());
   }

   /**
    * Get the collection name.
    *
    * @returns {string} The collection name.
    */
   static getCollectionName(): string {
      return this._getConfig().name;
   }

   /**
    * Get the database name of the collection.
    *
    * @returns {string} The database name.
    */
   static getDbName(): string {

      if (typeof this._getConfig().database === "string") {
         return this._getConfig().database as string;
      }

      if (this._getConfig().database instanceof Db) {
         return (this._getConfig().database as Db).databaseName;
      }

      throw new Error("Invalid typeof database name");
   }

   /**
    * Get the database instance of the collection.
    *
    * @returns {Db} The database instance.
    */
   static getDb(): Db {
      const { client } = this._getConfig();

      if (client) {
         return client.db(this.getDbName());
      }

      return MongoDB.db(this.getDbName());
   }

   /**
    * Get One document from the collection.
    *
    * @example
    *
    * const user = await Users.findOne <User> ({ _id: "123" });
    *
    * @param {Filter<TSchema>} filter The filter to use.
    * @param {FindOptions<TSchema>} options The options to use.
    *
    * @returns {Promise<Document<TSchema>> | null>} The document.
    */
   static async findOne<TSchema extends Document = any>(filter: Filter<TSchema>, options?: FindOptions<TSchema>): Promise<TSchema | null> {
      return this.getCollection<TSchema>().findOne(filter as MongoFilter<TSchema>, options);
   }

   /**
    * Get many documents from the collection.
    *
    * @example
    *
    * const user = await Users.find <User> ({ _id: "123" });
    *
    * @param {Filter<TSchema>} filter The filter to use.
    * @param {FindOptions<TSchema>} options The options to use.
    *
    * @returns {Promise<FindCursor<TSchema>>} The cursor.
    */
   static async find<TSchema extends Document = any>(filter: Filter<TSchema>, options?: FindOptions<TSchema>): Promise<FindCursor<TSchema>> {
      return this.getCollection<TSchema>().find<TSchema>(filter as MongoFilter<TSchema>, options);
   }

   /**
    * Insert one document into the collection.
    *
    * @example
    *
    * const user = await Users.insertOne <User> ({ _id: "123", name: "John Doe" });
    *
    * @param {TSchema} document The document to insert.
    * @param {InsertOneOptions} options The options to use.
    *
    * @returns {Promise<InsertOneResult<TSchema>>} The result.
    */
   static async insertOne<TSchema extends Document = any>(document: OptionalId<TSchema>, options?: InsertOneOptions): Promise<InsertOneResult<TSchema>> {
      return this.getCollection().insertOne(this._updateTimestamps(document, true), options as InsertOneOptions);
   }

   /**
    * Insert many documents into the collection.
    *
    * @example
    *
    * const user = await Users.insertMany <User> ([{ _id: "123", name: "John Doe" }, { _id: "123", name: "John Doe" }]);
    *
    * @param {TSchema[]} documents The documents to insert.
    * @param {BulkWriteOptions} options The options to use.
    *
    * @returns {Promise<InsertManyResult<TSchema>>} The result.
    */
   static async insertMany<TSchema extends Document = any>(documents: OptionalId<TSchema>[], options?: BulkWriteOptions): Promise<InsertManyResult<TSchema>> {
      let newDocuments = documents.map(document => this._updateTimestamps(document, true));
      return this.getCollection().insertMany(newDocuments, options as BulkWriteOptions);
   }

   /**
    * Update one document in the collection.
    *
    * @example
    *
    * const user = await Users.updateOne <User> ({ _id: "123" }, { $set: { name: "John Doe" } });
    *
    * @param {Filter<TSchema>} filter The filter to use.
    * @param {UpdateQuery<TSchema>} update The update to use.
    *
    * @returns {Promise<UpdateResult>} The result.
    */
   static async updateOne<TSchema extends Document = any>(filter: Filter<TSchema>, update: UpdateQuery<TSchema>): Promise<UpdateResult> {
      return this.getCollection<TSchema>().updateOne(filter as MongoFilter<TSchema>, this._updateTimestamps(update, false));
   }

   /**
    * Update many documents in the collection.
    *
    * @example
    *
    * const user = await Users.updateMany <User> ({ _id: "123" }, { $set: { name: "John Doe" } });
    *
    * @param {Filter<TSchema>} filter The filter to use.
    * @param {UpdateQuery<TSchema>} update The update to use.
    * @param {UpdateOptions} options The options to use.
    *
    * @returns {Promise<UpdateResult>} The result.
    */
   static async updateMany<TSchema extends Document = any>(filter: Filter<TSchema>, update: UpdateQuery<TSchema>, options?: UpdateOptions): Promise<UpdateResult> {
      return this.getCollection<TSchema>().updateMany(filter as MongoFilter<TSchema>, this._updateTimestamps(update, false), options as UpdateOptions);
   }

   /**
    * Delete one document from the collection.
    *
    * @example
    *
    * const user = await Users.deleteOne <User> ({ _id: "123" });
    *
    * @param {Filter<TSchema>} filter The filter to use.
    * @param {DeleteOptions} options The options to use.
    *
    * @returns {Promise<DeleteResult>} The result.
    */
   static async deleteOne<TSchema extends Document = any>(filter: Filter<TSchema>, options?: DeleteOptions): Promise<DeleteResult> {
      return this.getCollection<TSchema>().deleteOne(filter as MongoFilter<TSchema>, options as DeleteOptions);
   }

   /**
    * Delete many documents from the collection.
    *
    * @example
    *
    * const user = await Users.deleteMany <User> ({ _id: "123" });
    *
    * @param {Filter<TSchema>} filter The filter to use.
    * @param {DeleteOptions} options The options to use.
    *
    * @returns {Promise<DeleteResult>} The result.
    */
   static async deleteMany<TSchema extends Document = any>(filter: Filter<TSchema>, options?: DeleteOptions): Promise<DeleteResult> {
      return this.getCollection<TSchema>().deleteMany(filter as MongoFilter<TSchema>, options as DeleteOptions);
   }

}
